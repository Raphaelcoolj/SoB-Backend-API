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

// Protected routes (move to top to protect all)
router.use(protect);

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
router.put("/me/privacy", userController.togglePrivacy);
router.get("/me/blocked", userController.getBlockedUsers);
router.post("/push-subscription", userController.savePushSubscription);
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

// Public/Optional routes (re-add protected status for specific handlers if needed)
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

// Other routes that might need protection
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
