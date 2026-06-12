import express from "express";
import { body, param } from "express-validator";
import * as fieldController from "../controllers/field.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import admin from "../middlewares/admin.middleware.js";
import validate from "../middlewares/validate.middleware.js";

const router = express.Router();

router.get("/", fieldController.getAllFields);

router.post(
  "/",
  [
    protect,
    admin,
    body("name").trim().notEmpty().withMessage("Field name is required"),
    validate,
  ],
  fieldController.createField,
);

router.delete(
  "/:id",
  [
    protect,
    admin,
    param("id").isMongoId().withMessage("Invalid Field ID format"),
    validate,
  ],
  fieldController.deleteField,
);

export default router;
