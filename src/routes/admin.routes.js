import express from "express";
import { body, param } from "express-validator";
import * as adminController from "../controllers/admin.controller.js";
import * as analyticsService from "../services/analytics.service.js";
import { deletePost } from "../controllers/post.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import admin from "../middlewares/admin.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import apiResponse from "../utils/apiResponse.js";

const router = express.Router();

router.use(protect);
router.use(admin);

// NEW: Analytics Routes
router.get("/analytics/dau", async (req, res) =>
  res
    .status(200)
    .json(
      apiResponse.success(
        "DAU retrieved.",
        await analyticsService.calculateDAU(req.query.date),
      ),
    ),
);
router.get("/analytics/wau", async (req, res) =>
  res
    .status(200)
    .json(
      apiResponse.success(
        "WAU retrieved.",
        await analyticsService.calculateWAU(req.query.weekStart),
      ),
    ),
);
router.get("/analytics/mau", async (req, res) =>
  res
    .status(200)
    .json(
      apiResponse.success(
        "MAU retrieved.",
        await analyticsService.calculateMAU(req.query.year, req.query.month),
      ),
    ),
);
router.get("/analytics/ratio", async (req, res) =>
  res
    .status(200)
    .json(
      apiResponse.success(
        "Ratio retrieved.",
        await analyticsService.calculateDAUWAURatio(req.query.date),
      ),
    ),
);
router.get("/analytics/breakdown", async (req, res) =>
  res
    .status(200)
    .json(
      apiResponse.success(
        "Breakdown retrieved.",
        await analyticsService.getActivityBreakdown(
          req.query.startDate,
          req.query.endDate,
        ),
      ),
    ),
);
router.get("/analytics/top-users", async (req, res) =>
  res
    .status(200)
    .json(
      apiResponse.success(
        "Top users retrieved.",
        await analyticsService.getTopActiveUsers(
          req.query.startDate,
          req.query.endDate,
          req.query.limit,
        ),
      ),
    ),
);
router.get("/analytics/summary", async (req, res) =>
  res
    .status(200)
    .json(
      apiResponse.success(
        "Summary retrieved.",
        await analyticsService.getSummary(),
      ),
    ),
);

router.get("/users", adminController.getAllUsers);
router.delete(
  "/users/:id",
  [param("id").isMongoId().withMessage("Invalid User ID format"), validate],
  adminController.deleteUser,
);
router.put(
  "/users/:id/role",
  [
    param("id").isMongoId().withMessage("Invalid User ID format"),
    body("role")
      .isIn(["user", "admin"])
      .withMessage("Role must be user or admin"),
    validate,
  ],
  adminController.updateUserRole,
);

// NEW: Founder Badge Route
router.put(
  "/users/:id/founder-badge",
  [
    param("id").isMongoId().withMessage("Invalid User ID format"),
    body("founderBadge").isBoolean().withMessage("founderBadge must be a boolean"),
    validate,
  ],
  adminController.toggleFounderBadge,
);

// NEW: Field Boost Route
router.put(
  "/fields/:id/boost",
  [
    param("id").isMongoId().withMessage("Invalid Field ID format"),
    body("boostWeight")
      .isFloat({ min: 0.1, max: 5.0 })
      .withMessage("boostWeight must be a number between 0.1 and 5.0"),
    validate,
  ],
  adminController.updateFieldBoost,
);

router.get("/posts", adminController.getAllPostsAdmin);
router.delete(
  "/posts/:id",
  [param("id").isMongoId().withMessage("Invalid Post ID format"), validate],
  deletePost,
);

router.post(
  "/email/broadcast",
  [
    body("subject").trim().notEmpty().withMessage("Email subject is required"),
    body("body").trim().notEmpty().withMessage("Email body is required"),
    validate,
  ],
  adminController.broadcastEmail,
);

router.get("/stats", adminController.getStats);

export default router;
