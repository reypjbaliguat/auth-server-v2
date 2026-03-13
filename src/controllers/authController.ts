import { Request, Response } from "express";
import User from "../models/User";
import { authService } from "../services/AuthService";
import { googleAuthService } from "../services/GoogleAuthService";
import { otpService } from "../services/OTPService";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/generateToken";

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const result = await authService.registerUser(email, password);

    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }

    if (result.message) {
      // Password added to existing social account
      return res.status(200).json({ message: result.message });
    }

    // Generate and send OTP for new user
    await otpService.generateAndSendOTP(
      result?.user?._id.toString()!,
      result?.user?.email!,
    );

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const result = await authService.validateCredentials(email, password);

    if (!result.success) {
      const statusCode =
        result.error === "User not found"
          ? 404
          : result.error === "Invalid credentials"
            ? 401
            : 400;
      return res.status(statusCode).json({ message: result.error });
    }

    // Generate and send OTP
    await otpService.generateAndSendOTP(
      result.user?._id.toString()!,
      result.user?.email!,
    );

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const verifyUserOTP = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isValid = await otpService.verifyAndConsumeOTP(
      user._id.toString(),
      otp,
    );
    if (!isValid) {
      return res.status(400).json({ message: "OTP expired or invalid" });
    }
    // Mark email as verified if not already
    if (!user.emailVerified) {
      user.emailVerified = true;
      await user.save();
    }

    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    res.status(200).json({ accessToken, refreshToken, user });
  } catch (err) {
    console.error("VerifyOTP error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Google Login
export const googleLogin = async (req: Request, res: Response) => {
  console.log("Google login attempt");
  const { credential } = req.body;

  // Input validation
  if (!credential) {
    return res.status(400).json({
      message: "Google credential is required",
    });
  }

  try {
    // Verify Google token
    const tokenInfo = await googleAuthService.verifyGoogleToken(credential);

    // Process login with enhanced account linking
    const result = await googleAuthService.processGoogleLogin(tokenInfo);
    const { user, message, metadata } = result;

    // Generate tokens
    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    // Return comprehensive response with linking information
    res.json({
      accessToken,
      refreshToken,
      message,
      user: {
        id: user._id,
        email: user.email,
        emailVerified: user.emailVerified,
        profile: user.profile,
      },
      // Provide metadata for client-side UX decisions
      accountLinking: {
        isNewUser: metadata?.isNewUser || false,
        isLinkedAccount: metadata?.isLinkedAccount || false,
        profileUpdated: metadata?.profileUpdated || false,
      },
    });
  } catch (err) {
    console.error("Google login error:", err);

    const errorMessage =
      err instanceof Error
        ? err.message
        : "Authentication failed. Please try again.";
    const statusCode =
      errorMessage.includes("Invalid") || errorMessage.includes("not verified")
        ? 400
        : 500;

    res.status(statusCode).json({ message: errorMessage });
  }
};

// Get OTP status for email - check if can resend
export const getOTPStatus = async (req: Request, res: Response) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const status = await otpService.getOTPStatus(user._id.toString());

    res.status(200).json(status);
  } catch (err) {
    console.error("Get OTP Status error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Resend OTP
export const resendOTP = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const result = await otpService.resendOTP(user._id.toString(), user.email);

    if (!result.success) {
      return res.status(429).json({
        message: result.message,
        canResendAt: result.canResendAt,
      });
    }

    res.status(200).json({
      message: result.message,
      canResendAt: result.canResendAt,
    });
  } catch (err) {
    console.error("Resend OTP error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Forgot Password - Send password reset OTP
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const result = await authService.initiatePasswordReset(email);

    if (!result.success) {
      const statusCode = result.error === "User not found" ? 404 : 400;
      return res.status(statusCode).json({ message: result.error });
    }

    // Generate and send password reset OTP
    await otpService.generateAndSendPasswordResetOTP(
      result.user?._id.toString()!,
      result.user?.email!,
    );

    res.status(200).json({ message: "Password reset code sent to your email" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Reset Password - Verify OTP and update password
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({
        message: "Email, OTP, and new password are required",
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify OTP
    const isValidOTP = await otpService.verifyAndConsumeOTP(
      user._id.toString(),
      otp,
    );

    if (!isValidOTP) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Reset password
    const resetResult = await authService.resetPassword(email, password);

    if (!resetResult.success) {
      return res.status(400).json({ message: resetResult.error });
    }

    res.status(200).json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
