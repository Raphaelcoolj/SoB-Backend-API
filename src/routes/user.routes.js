import express from "express";
import { body, param } from "express-validator";
import mongoose from "mongoose";
import * as userController from "../controllers/user.controller.js";
import { protect, optionalProtect } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { pingRateLimiter } from "../middlewares/rateLimit.middleware.js";
import validate from "../middlewares/validate.middleware.js";

const router = express.Router();
router.use((req, res, next) => {
  console.log(`User route hit: ${req.method} ${req.path}`);
  next();
});
const isMongoId = (id) => mongoose.Types.ObjectId.isValid(id);

// Public routes
router.get(
  "/:username",
  [
    param("username")
      .trim()
      .notEmpty()
      .withMessage("Username param is required"),
    validate,
  ],
  userController.getPublicProfile,
);

// Protected routes
router.use(protect);

router.post(
  "/ping",
  pingRateLimiter,
  [
    body("sessionDuration")
      .isNumeric()
      .withMessage("Session duration must be a number"),
    validate,
  ],
  userController.ping,
);

router.get("/me", userController.getMe);

router.put(
  "/me",
  upload.single("avatar"),
  [
    body("name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Name cannot be empty"),
    body("bio").optional().trim(),
    validate,
  ],
  userController.updateMe,
);

router.delete("/me", userController.deleteMe);

// IMPORTANT: /me/fields and /me/notifications must come BEFORE /:username
// (Note: Since we moved :username to public, this order matters less, 
// but it is good practice to keep them distinct)
router.put(
  "/me/fields",
  [
    body("priorityFields")
      .isArray({ min: 5, max: 5 })
      .withMessage("You must select exactly 5 priority fields")
      .custom((arr) => arr.every((id) => isMongoId(id)))
      .withMessage("Priority fields must contain valid field IDs"),
    validate,
  ],
  userController.updateFields,
);

router.put(
  "/me/notifications",
  [
    body("emailNotifications")
      .isArray()
      .withMessage("Email notifications must be an array")
      .custom((arr) => arr.every((id) => isMongoId(id)))
      .withMessage("Email notifications must contain valid field IDs"),
    validate,
  ],
  userController.updateNotifications,
);

router.post("/push-subscription", userController.savePushSubscription);

// PRIVACY & BLOCKING
router.put("/me/privacy", userController.togglePrivacy);
router.get("/me/blocked", userController.getBlockedUsers);
router.post(
  "/:id/block",
  [param("id").isMongoId().withMessage("Invalid User ID format"), validate],
  userController.toggleBlockUser,
);

router.post(
  "/:id/follow",
  [param("id").isMongoId().withMessage("Invalid User ID format"), validate],
  userController.toggleFollow,
);

router.get(
  "/:id/followers",
  [
    optionalProtect,
    param("id").isMongoId().withMessage("Invalid User ID format"),
    validate,
  ],
  userController.getFollowers,
);

router.get(
  "/:id/following",
  [
    optionalProtect,
    param("id").isMongoId().withMessage("Invalid User ID format"),
    validate,
  ],
  userController.getFollowing,
);

export default router;
