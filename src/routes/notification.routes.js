import express from 'express';
import { param } from 'express-validator';
import * as notificationController from '../controllers/notification.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validate.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/', notificationController.getMyNotifications);

// Static route BEFORE dynamic /:id/read to prevent 'read-all' being matched as an ID
router.put('/read-all', notificationController.markAllAsRead);

router.put('/:id/read',
  [param('id').isMongoId().withMessage('Invalid Notification ID format'), validate],
  notificationController.markAsRead
);

export default router;
