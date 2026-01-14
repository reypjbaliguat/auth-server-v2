import { Router } from "express";
import {
  googleLogin,
  login,
  register,
  verifyUserOTP,
} from "../controllers/authController";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/verify-otp", verifyUserOTP);
router.post("/google-login", googleLogin);

export default router;
