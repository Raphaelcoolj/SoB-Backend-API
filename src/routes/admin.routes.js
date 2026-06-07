import express from 'express';
import { body, param } from 'express-validator';
import * as adminController from '../controllers/admin.controller.js';
import { deletePost } from '../controllers/post.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import admin from '../middlewares/admin.middleware.js';
import validate from '../middlewares/validate.middleware.js';

const router = express.Router();

router.use(protect);
router.use(admin);

router.get('/users', adminController.getAllUsers);
router.delete('/users/:id', [param('id').isMongoId().withMessage('Invalid User ID format'), validate], adminController.deleteUser);
router.put('/users/:id/role', [param('id').isMongoId().withMessage('Invalid User ID format'), body('role').isIn(['user', 'admin']).withMessage('Role must be user or admin'), validate], adminController.updateUserRole);

router.get('/posts', adminController.getAllPostsAdmin);
router.delete('/posts/:id', [param('id').isMongoId().withMessage('Invalid Post ID format'), validate], deletePost);

router.post('/email/broadcast',
  [body('subject').trim().notEmpty().withMessage('Email subject is required'), body('body').trim().notEmpty().withMessage('Email body is required'), validate],
  adminController.broadcastEmail
);

router.get('/stats', adminController.getStats);

export default router;
