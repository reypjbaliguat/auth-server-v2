import { Router } from "express";
import {
  forgotPassword,
  getOTPStatus,
  googleLogin,
  linkPassword,
  login,
  register,
  resendOTP,
  resetPassword,
  verifyPasswordLink,
  verifyUserOTP,
} from "../controllers/authController";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/verify-otp", verifyUserOTP);
router.post("/google-login", googleLogin);
router.get("/otp-status/:email", getOTPStatus);
router.post("/resend-otp", resendOTP);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/link-password", linkPassword);
router.post("/verify-password-link", verifyPasswordLink);

export default router;
