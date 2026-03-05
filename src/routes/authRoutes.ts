import { Router } from "express";
import {
    forgotPassword,
    getOTPStatus,
    googleLogin,
    login,
    register,
    resendOTP,
    resetPassword,
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

export default router;
