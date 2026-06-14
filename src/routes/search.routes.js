import express from "express";
import * as searchController from "../controllers/search.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/posts", protect, searchController.searchPosts);
router.get("/users", protect, searchController.searchUsers);

export default router;
