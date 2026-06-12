import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import apiResponse from '../utils/apiResponse.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json(apiResponse.error('Not authorized, access token missing'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json(apiResponse.error('Not authorized, user no longer exists'));
    }

    req.user = user;

    // IMPROVED: Block unverified users from protected routes
    const path = req.baseUrl + req.path;
    const publicPaths = ['/api/auth/complete-onboarding', '/api/auth/logout', '/api/auth/verify-email', '/api/auth/resend-verification'];
    
    if (!user.isVerified && !publicPaths.includes(path)) {
      return res.status(403).json(
        apiResponse.error('Email not verified. Please verify your email to continue.', { isVerified: false })
      );
    }

    // Enforce onboarding check
    if (!user.isOnboarded && path !== '/api/auth/complete-onboarding' && path !== '/api/auth/logout') {
      return res.status(403).json(
        apiResponse.error('Onboarding incomplete. Please complete your profile to continue.', { isOnboarded: false })
      );
    }

    next();
  } catch (error) {
    return res.status(401).json(apiResponse.error('Not authorized, token is invalid or expired'));
  }
};
