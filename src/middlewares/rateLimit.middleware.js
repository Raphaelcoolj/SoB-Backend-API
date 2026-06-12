import rateLimit from 'express-rate-limit';
import apiResponse from '../utils/apiResponse.js';

// IMPROVED: Strict rate limiting for security-sensitive endpoints

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests
  message: apiResponse.error('Too many attempts from this IP. Please try again after 15 minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

export const pingRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 requests
  message: apiResponse.error('Too many ping requests. Please try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
});

export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 uploads
  message: apiResponse.error('Upload limit reached. Please try again after 15 minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});
