import { Router } from "express";

import {
  register,
  login,
  logout,
  refresh,
  me,
} from "../controllers/authController.js";

import { protect } from "../middleware/protect.js";

const router = Router();

// Create a new account.
router.post("/register", register);

// Log in with email and password.
router.post("/login", login);

// Log out and revoke the refresh session.
router.post("/logout", logout);

// Refresh the authentication session.
router.post("/refresh", refresh);

// Get the currently authenticated user.
router.get("/me", protect, me);

export default router;
