import express from 'express';
import { body } from 'express-validator';
import passport from 'passport';
import mongoose from 'mongoose';
import * as authController from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validate.middleware.js';

const router = express.Router();

const isMongoId = (id) => mongoose.Types.ObjectId.isValid(id);

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('username').trim().notEmpty().withMessage('Username is required')
      .isAlphanumeric('en-US', { ignore: '_' }).withMessage('Username must contain only letters, numbers, and underscores')
      .isLength({ min: 3, max: 20 }).withMessage('Username must be between 3 and 20 characters'),
    body('email').trim().isEmail().withMessage('Please enter a valid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    validate,
  ],
  authController.register
);

router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('Please enter a valid email address'),
    body('password').notEmpty().withMessage('Password is required'),
    validate,
  ],
  authController.login
);

router.post('/logout', protect, authController.logout);

router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token is required'), validate],
  authController.refresh
);

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=oauth_failed`,
  }),
  authController.googleSuccess
);

router.post(
  '/complete-onboarding',
  protect,
  [
    body('username').trim().notEmpty().withMessage('Username is required')
      .isAlphanumeric('en-US', { ignore: '_' }).withMessage('Username must contain only letters, numbers, and underscores')
      .isLength({ min: 3, max: 20 }).withMessage('Username must be between 3 and 20 characters'),
    body('priorityFields').isArray({ min: 5, max: 5 }).withMessage('You must select exactly 5 priority fields')
      .custom((arr) => arr.every((id) => isMongoId(id))).withMessage('Priority fields must contain valid field IDs'),
    validate,
  ],
  authController.completeOnboarding
);

export default router;
