import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Field from '../models/Field.js';
import apiResponse from '../utils/apiResponse.js';
import { generateAccessToken, generateRefreshToken } from '../utils/generateTokens.js';

export const register = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) return res.status(400).json(apiResponse.error('Email is already registered.'));

    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername) return res.status(400).json(apiResponse.error('Username is already taken.'));

    const user = new User({ name, username: username.toLowerCase(), email: email.toLowerCase(), password, isOnboarded: false });

    const accessToken = generateAccessToken(user);
    const rawRefreshToken = generateRefreshToken(user);

    const salt = await bcrypt.genSalt(12);
    user.refreshToken = await bcrypt.hash(rawRefreshToken, salt);
    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshToken;

    return res.status(201).json(apiResponse.success('Registration successful. Please complete onboarding.', { user: userResponse, accessToken, refreshToken: rawRefreshToken }));
  } catch (error) {
    console.error('Registration Error:', error.message);
    return res.status(500).json(apiResponse.error('Internal server error during registration.'));
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json(apiResponse.error('Invalid email or password.'));

    if (user.googleId && !user.password) {
      return res.status(400).json(apiResponse.error('This email is linked to a Google account. Please use Google Login.'));
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json(apiResponse.error('Invalid email or password.'));

    const accessToken = generateAccessToken(user);
    const rawRefreshToken = generateRefreshToken(user);

    const salt = await bcrypt.genSalt(12);
    user.refreshToken = await bcrypt.hash(rawRefreshToken, salt);
    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshToken;

    return res.status(200).json(apiResponse.success('Login successful.', { user: userResponse, accessToken, refreshToken: rawRefreshToken }));
  } catch (error) {
    console.error('Login Error:', error.message);
    return res.status(500).json(apiResponse.error('Internal server error during login.'));
  }
};

export const logout = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) { user.refreshToken = null; await user.save(); }
    return res.status(200).json(apiResponse.success('Logged out successfully.'));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error during logout.'));
  }
};

export const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json(apiResponse.error('Refresh token is required.'));

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json(apiResponse.error('Invalid or expired refresh token.'));
    }

    const user = await User.findById(decoded.id);
    if (!user?.refreshToken) return res.status(401).json(apiResponse.error('Session expired. Please log in again.'));

    const isMatch = await user.compareRefreshToken(refreshToken);
    if (!isMatch) return res.status(401).json(apiResponse.error('Session invalid. Please log in again.'));

    return res.status(200).json(apiResponse.success('Token refreshed successfully.', { accessToken: generateAccessToken(user) }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error during token refresh.'));
  }
};

export const completeOnboarding = async (req, res) => {
  try {
    const { username, priorityFields } = req.body;
    const userId = req.user._id;

    if (!Array.isArray(priorityFields) || priorityFields.length !== 5) {
      return res.status(400).json(apiResponse.error('Onboarding requires selecting exactly 5 priority fields.'));
    }

    const fieldsCount = await Field.countDocuments({ _id: { $in: priorityFields } });
    if (fieldsCount !== 5) return res.status(400).json(apiResponse.error('One or more selected fields are invalid.'));

    const checkUsername = username.toLowerCase();
    const existingUser = await User.findOne({ username: checkUsername, _id: { $ne: userId } });
    if (existingUser) return res.status(400).json(apiResponse.error('Username is already taken by another user.'));

    const user = await User.findById(userId);
    user.username = checkUsername;
    user.priorityFields = priorityFields;
    user.emailNotifications = priorityFields;
    user.isOnboarded = true;
    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshToken;

    return res.status(200).json(apiResponse.success('Onboarding completed successfully.', { user: userResponse }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error during onboarding completion.'));
  }
};

export const googleSuccess = async (req, res) => {
  try {
    const user = req.user;
    const accessToken = generateAccessToken(user);
    const rawRefreshToken = generateRefreshToken(user);

    const salt = await bcrypt.genSalt(12);
    user.refreshToken = await bcrypt.hash(rawRefreshToken, salt);
    await user.save();

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${clientUrl}/oauth-callback?token=${accessToken}&refreshToken=${rawRefreshToken}&isOnboarded=${user.isOnboarded}`);
  } catch (error) {
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=oauth_failed`);
  }
};
