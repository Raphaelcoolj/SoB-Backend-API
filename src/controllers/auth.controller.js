import bcrypt from 'bcrypt';
import User from '../models/User.js';
import Field from '../models/Field.js';
import apiResponse from '../utils/apiResponse.js';
import { generateAccessToken, generateRefreshToken } from '../utils/generateTokens.js';
import { sendEmail } from '../utils/sendEmail.js';

// IMPROVED: Helper to generate 5-digit numeric code
const generateNumericCode = () => Math.floor(10000 + Math.random() * 90000).toString();

export const register = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) return res.status(400).json(apiResponse.error('Email is already registered.'));

    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername) return res.status(400).json(apiResponse.error('Username is already taken.'));

    // IMPROVED: Generate verification code
    const verificationCode = generateNumericCode();
    const verificationCodeExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = new User({ 
      name, 
      username: username.toLowerCase(), 
      email: email.toLowerCase(), 
      password, 
      isOnboarded: false,
      verificationCode,
      verificationCodeExpiry
    });

    // IMPROVED: Send verification email
    await sendEmail({
      to: user.email,
      subject: 'Verify your SoB account',
      html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #eee;border-radius:10px">
        <h2>Welcome to SoB!</h2>
        <p>Your verification code is: <b style="font-size:24px;color:#007bff">${verificationCode}</b></p>
        <p>This code expires in 24 hours.</p>
        <hr>
        <p style="font-size:12px;color:#666">If you see this email in spam, please mark it as "Not Spam" to ensure you receive future emails from SoB.</p>
      </div>`
    });

    const accessToken = generateAccessToken(user);
    const rawRefreshToken = generateRefreshToken(user);

    const salt = await bcrypt.genSalt(12);
    user.refreshToken = await bcrypt.hash(rawRefreshToken, salt);
    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshToken;
    delete userResponse.verificationCode;
    delete userResponse.verificationCodeExpiry;

    return res.status(201).json(apiResponse.success('Registration successful. Please check your email for the verification code.', { user: userResponse, accessToken, refreshToken: rawRefreshToken }));
  } catch (error) {
    console.error('Registration Error Details:', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });
    return res.status(500).json(apiResponse.error('Internal server error during registration.', error.message));
  }
};

// IMPROVED: Email Verification logic
export const verifyEmail = async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findOne({
      verificationCode: code,
      verificationCodeExpiry: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json(apiResponse.error('Invalid or expired verification code.'));

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpiry = undefined;
    await user.save();

    return res.status(200).json(apiResponse.success('Email verified successfully.'));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Error verifying email.'));
  }
};

// IMPROVED: Resend Verification logic
export const resendVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.isVerified) return res.status(400).json(apiResponse.error('Account is already verified.'));

    const verificationCode = generateNumericCode();
    user.verificationCode = verificationCode;
    user.verificationCodeExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    await sendEmail({
      to: user.email,
      subject: 'Your new SoB verification code',
      html: `<p>Your new verification code is: <b>${verificationCode}</b>. It expires in 24 hours.</p>
        <hr>
        <p style="font-size:12px;color:#666">If you see this email in spam, please mark it as "Not Spam" to ensure you receive future emails from SoB.</p>`
    });

    return res.status(200).json(apiResponse.success('Verification code resent.'));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Error resending verification code.'));
  }
};

// IMPROVED: Forgot Password logic
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json(apiResponse.error('User with this email does not exist.'));

    const resetCode = generateNumericCode();
    user.resetPasswordCode = resetCode;
    user.resetPasswordCodeExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    await sendEmail({
      to: user.email,
      subject: 'SoB Password Reset',
      html: `<p>Your password reset code is: <b style="font-size:24px">${resetCode}</b>. It expires in 1 hour.</p>
        <hr>
        <p style="font-size:12px;color:#666">If you see this email in spam, please mark it as "Not Spam" to ensure you receive future emails from SoB.</p>`
    });

    return res.status(200).json(apiResponse.success('Password reset code sent to your email.'));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Error in forgot password flow.'));
  }
};

// IMPROVED: Reset Password logic
export const resetPassword = async (req, res) => {
  try {
    const { code, newPassword } = req.body;
    const user = await User.findOne({
      resetPasswordCode: code,
      resetPasswordCodeExpiry: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json(apiResponse.error('Invalid or expired reset code.'));

    user.password = newPassword; // Pre-save hook will hash it
    user.resetPasswordCode = undefined;
    user.resetPasswordCodeExpiry = undefined;
    user.refreshToken = null; // Invalidate sessions
    await user.save();

    return res.status(200).json(apiResponse.success('Password reset successful. Please log in with your new password.'));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Error resetting password.'));
  }
};

// IMPROVED: Email Verification logic

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
    const { username, priorityFields, dob, bio } = req.body;
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
    user.bio = bio; // save bio
    user.priorityFields = priorityFields;
    user.emailNotifications = priorityFields;
    user.dob = dob;
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
    console.log('Google Success callback for user:', user._id);
    const accessToken = generateAccessToken(user);
    const rawRefreshToken = generateRefreshToken(user);

    const salt = await bcrypt.genSalt(12);
    user.refreshToken = await bcrypt.hash(rawRefreshToken, salt);
    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshToken;

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const redirectUrl = `${clientUrl}/oauth-callback?token=${accessToken}&refreshToken=${rawRefreshToken}&isOnboarded=${user.isOnboarded}`;
    console.log('Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Google Success Controller Error:', error);
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=oauth_failed`);
  }
};
