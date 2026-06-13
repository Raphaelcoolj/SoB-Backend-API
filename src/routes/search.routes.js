import express from "express";
import * as searchController from "../controllers/search.controller.js";
import { optionalProtect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/posts", optionalProtect, searchController.searchPosts);
router.get("/users", optionalProtect, searchController.searchUsers);

export default router;
