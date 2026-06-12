import express from "express";
import { body, param } from "express-validator";
import * as commentController from "../controllers/comment.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";

const router = express.Router();

// Public
router.get(
  "/post/:postId",
  [param("postId").isMongoId().withMessage("Invalid Post ID format"), validate],
  commentController.getCommentsByPost,
);
router.get(
  "/:id/replies",
  [param("id").isMongoId().withMessage("Invalid Comment ID format"), validate],
  commentController.getCommentReplies,
);

// Protected
router.use(protect);

router.post(
  "/",
  [
    body("post").isMongoId().withMessage("Invalid Post ID format"),
    body("body").trim().notEmpty().withMessage("Comment body is required"),
    body("type")
      .optional()
      .isIn(["comment", "debate"])
      .withMessage("Type must be comment or debate"),
    body("parentComment")
      .optional()
      .isMongoId()
      .withMessage("Invalid parent comment ID format"),
    validate,
  ],
  commentController.createComment,
);

router.put(
  "/:id",
  [
    param("id").isMongoId().withMessage("Invalid Comment ID format"),
    body("body").trim().notEmpty().withMessage("Comment body is required"),
    validate,
  ],
  commentController.editComment,
);

router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid Comment ID format"), validate],
  commentController.deleteComment,
);
router.post(
  "/:id/like",
  [param("id").isMongoId().withMessage("Invalid Comment ID format"), validate],
  commentController.toggleLikeComment,
);

export default router;
