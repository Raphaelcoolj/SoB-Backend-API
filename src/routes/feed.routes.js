import express from 'express';
import { param } from 'express-validator';
import * as feedController from '../controllers/feed.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validate.middleware.js';

const router = express.Router();

router.get('/fyf', protect, feedController.getForYouFeed);
router.get('/latest', feedController.getLatestPosts);
router.get('/field/:fieldId', [param('fieldId').isMongoId().withMessage('Invalid Field ID format'), validate], feedController.getPostsByField);

export default router;
