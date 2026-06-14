import express from "express";
import { body, param } from "express-validator";
import * as postController from "../controllers/post.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { uploadRateLimiter } from "../middlewares/rateLimit.middleware.js";
import validate from "../middlewares/validate.middleware.js";

const router = express.Router();

// Public routes
router.get("/", postController.getAllPosts);
router.get("/bookmarks", protect, postController.getBookmarks); // Move to top
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid Post ID format"), validate],
  postController.getPostById,
);
// NEW: Public preview route for OG metadata
router.get(
  "/:id/preview",
  [param("id").isMongoId().withMessage("Invalid Post ID format"), validate],
  postController.getPostPreview,
);
router.get(
  "/user/:userId",
  [param("userId").isMongoId().withMessage("Invalid User ID format"), validate],
  postController.getPostsByUser,
);
router.post(
  "/:id/share",
  [param("id").isMongoId().withMessage("Invalid Post ID format"), validate],
  postController.sharePost,
);

// Protected routes
router.use(protect);

router.post(
  "/",
  uploadRateLimiter,
  upload.array("media", 5),
  [
    body("title").optional().trim().notEmpty().withMessage("Post title is required"),
    body("body").trim().notEmpty().withMessage("Post body is required"),
    body("field").optional().isMongoId().withMessage("Post field must be a valid ID"),
    validate,
  ],
  postController.createPost,
);

router.put(
  "/:id",
  uploadRateLimiter,
  upload.array("media", 5),
  [
    param("id").isMongoId().withMessage("Invalid Post ID format"),
    body("title")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Post title cannot be empty"),
    body("body")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Post body cannot be empty"),
    body("field")
      .optional()
      .isMongoId()
      .withMessage("Invalid field category ID"),
    validate,
  ],
  postController.editPost,
);

router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid Post ID format"), validate],
  postController.deletePost,
);
router.post(
  "/:id/like",
  [param("id").isMongoId().withMessage("Invalid Post ID format"), validate],
  postController.toggleLikePost,
);
router.post(
  "/:id/bookmark",
  [param("id").isMongoId().withMessage("Invalid Post ID format"), validate],
  postController.toggleBookmarkPost,
);

export default router;
