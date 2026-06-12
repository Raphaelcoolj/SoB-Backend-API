import express from "express";
import { param } from "express-validator";
import * as feedController from "../controllers/feed.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";

const router = express.Router();

// NEW: Invalidation logic needs to be integrated in user/post controllers
router.get("/fyf", protect, feedController.getForYouFeed);
router.get("/latest", feedController.getLatestPosts);
router.get("/discovery", feedController.getDiscoveryFeed); // IMPROVED: Discovery with weighted seeding
router.get(
  "/top/:fieldId",
  [
    param("fieldId").isMongoId().withMessage("Invalid Field ID format"),
    validate,
  ],
  feedController.getTopPostsByField,
); // IMPROVED: Top 50 posts per field
router.get(
  "/field/:fieldId",
  [
    param("fieldId").isMongoId().withMessage("Invalid Field ID format"),
    validate,
  ],
  feedController.getPostsByField,
);

export default router;
