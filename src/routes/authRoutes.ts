import { Router } from "express";
import {
  getOTPStatus,
  googleLogin,
  login,
  register,
  resendOTP,
  verifyUserOTP,
} from "../controllers/authController";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/verify-otp", verifyUserOTP);
router.post("/google-login", googleLogin);
router.get("/otp-status/:email", getOTPStatus);
router.post("/resend-otp", resendOTP);

export default router;
