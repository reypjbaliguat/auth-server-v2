import { Router } from "express";
import {
  forgotPassword,
  getMe,
  getOTPStatus,
  googleLogin,
  linkGoogleAccount,
  linkPassword,
  login,
  logout,
  refreshAccessToken,
  register,
  resendOTP,
  resetPassword,
  verifyGoogleLink,
  verifyPasswordLink,
  verifyUserOTP,
} from "../controllers/authController";
import { requireAccessToken } from "../middlewares/authMiddleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/verify-otp", verifyUserOTP);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logout);
router.get("/me", requireAccessToken, getMe);
router.post("/google-login", googleLogin);
router.get("/otp-status/:email", getOTPStatus);
router.post("/resend-otp", resendOTP);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/link-password", linkPassword);
router.post("/verify-password-link", verifyPasswordLink);
router.post("/link-google-account", linkGoogleAccount);
router.post("/verify-google-link", verifyGoogleLink);

export default router;
