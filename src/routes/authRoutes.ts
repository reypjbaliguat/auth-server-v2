import { Router } from "express";
import {
  googleLogin,
  login,
  register,
  requestOTP,
  verifyUserOTP,
} from "../controllers/authController";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/request-otp", requestOTP);
router.post("/verify-otp", verifyUserOTP);
router.post("/google", googleLogin);

export default router;
