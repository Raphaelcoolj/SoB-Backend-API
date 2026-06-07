import express from 'express';
import * as searchController from '../controllers/search.controller.js';

const router = express.Router();

router.get('/posts', searchController.searchPosts);
router.get('/users', searchController.searchUsers);

export default router;
