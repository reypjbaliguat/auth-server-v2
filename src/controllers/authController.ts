import { Request, Response } from "express";
import Credential from "../models/Credential";
import User from "../models/User";
import { authService } from "../services/AuthService";
import { googleAuthService } from "../services/GoogleAuthService";
import { otpService } from "../services/OTPService";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/generateToken";
import { hashPassword } from "../utils/hashPassword";

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await authService.registerUser(email, password);
    if (!result.success) {
      return res.status(400).json({ message: result.error });
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

    // Check if there's already a Google credential for this Google account
    const existingGoogleCredential = await Credential.findOne({
      type: "google",
      provider: "google",
      providerUserId: tokenInfo.sub,
    });

    if (!existingGoogleCredential) {
      // Check if user exists with password authentication for same email
      const existingUser = await User.findOne({ email: tokenInfo.email });
      if (existingUser) {
        const passwordCredential = await Credential.findOne({
          userId: existingUser._id,
          type: "password",
        });
        console.log(tokenInfo);
        if (passwordCredential) {
          // Password account exists - return linking opportunity instead of auto-linking
          return res.status(400).json({
            error: "EMAIL_EXISTS_PASSWORD",
            email: tokenInfo.email,
          });
        }
      }
    }

    // No conflict or existing Google account - proceed with normal login/linking
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

// Link Password - Send OTP to link password to existing Google account
export const linkPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user has Google account credential
    const googleCredential = await Credential.findOne({
      userId: user._id,
      type: "google",
    });

    if (!googleCredential) {
      return res.status(400).json({
        message: "This account does not have Google authentication linked",
      });
    }

    // Check if user already has a password credential
    const passwordCredential = await Credential.findOne({
      userId: user._id,
      type: "password",
    });

    if (passwordCredential) {
      return res.status(400).json({
        message: "This account already has a password set",
      });
    }

    // Generate and send OTP for password linking
    await otpService.generateAndSendOTP(user._id.toString(), user.email);

    res
      .status(200)
      .json({ message: "OTP sent to your email for password linking" });
  } catch (err) {
    console.error("Link password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Verify Password Link - Verify OTP and link password to existing Google account
export const verifyPasswordLink = async (req: Request, res: Response) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({
        message: "Email, OTP, and password are required",
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify that user has Google credential
    const googleCredential = await Credential.findOne({
      userId: user._id,
      type: "google",
    });

    if (!googleCredential) {
      return res.status(400).json({
        message: "This account does not have Google authentication linked",
      });
    }

    // Check that user doesn't already have password credential
    const existingPasswordCredential = await Credential.findOne({
      userId: user._id,
      type: "password",
    });

    if (existingPasswordCredential) {
      return res.status(400).json({
        message: "This account already has a password set",
      });
    }

    // Verify OTP
    const isValidOTP = await otpService.verifyAndConsumeOTP(
      user._id.toString(),
      otp,
    );

    if (!isValidOTP) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Hash password and create password credential
    const passwordHash = await hashPassword(password);
    await Credential.create({
      userId: user._id,
      type: "password",
      passwordHash,
    });

    // Log account linking event for security
    console.log(
      `Password linking: Password credential linked to Google account user ${user._id} (${email})`,
    );

    // Generate tokens
    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    // Return tokens and user data
    res.status(200).json({
      message: "Password linked successfully to your Google account",
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        emailVerified: user.emailVerified,
        profile: user.profile,
      },
    });
  } catch (err) {
    console.error("Verify password link error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Link Google Account - Send OTP to link Google to existing password account
export const linkGoogleAccount = async (req: Request, res: Response) => {
  try {
    const { credential, email } = req.body;

    if (!credential || !email) {
      return res.status(400).json({
        message: "Google credential and email are required",
      });
    }

    // Verify Google token first
    const tokenInfo = await googleAuthService.verifyGoogleToken(credential);

    // Ensure the Google email matches the provided email
    if (tokenInfo.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({
        message: "Google account email does not match the provided email",
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user has password credential
    const passwordCredential = await Credential.findOne({
      userId: user._id,
      type: "password",
    });

    if (!passwordCredential) {
      return res.status(400).json({
        message:
          "This account does not have password authentication. Use Google sign-in instead.",
      });
    }

    // Check if user already has Google credential
    const existingGoogleCredential = await Credential.findOne({
      userId: user._id,
      type: "google",
    });

    if (existingGoogleCredential) {
      return res.status(400).json({
        message: "This account already has Google authentication linked",
      });
    }

    // Check if this Google account is already linked to another user
    const googleCredentialExists = await Credential.findOne({
      type: "google",
      provider: "google",
      providerUserId: tokenInfo.sub,
    });

    if (googleCredentialExists) {
      return res.status(400).json({
        message: "This Google account is already linked to another account",
      });
    }

    // Generate and send OTP for Google linking
    await otpService.generateAndSendOTP(user._id.toString(), user.email);

    res.status(200).json({
      message: "OTP sent to your email for Google account linking",
      email: user.email,
    });
  } catch (err) {
    console.error("Link Google account error:", err);

    const errorMessage = err instanceof Error ? err.message : "Server error";
    const statusCode =
      errorMessage.includes("Invalid") || errorMessage.includes("not verified")
        ? 400
        : 500;

    res.status(statusCode).json({ message: errorMessage });
  }
};

// Verify Google Link - Verify OTP and link Google to existing password account
export const verifyGoogleLink = async (req: Request, res: Response) => {
  console.log({ body: req.body });

  try {
    const { credential, email, otp } = req.body;

    if (!credential || !email || !otp) {
      return res.status(400).json({
        message: "Google credential, email, and OTP are required",
      });
    }

    // Verify Google token
    const tokenInfo = await googleAuthService.verifyGoogleToken(credential);

    // Ensure the Google email matches the provided email
    if (tokenInfo.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({
        message: "Google account email does not match the provided email",
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify that user has password credential
    const passwordCredential = await Credential.findOne({
      userId: user._id,
      type: "password",
    });

    if (!passwordCredential) {
      return res.status(400).json({
        message: "This account does not have password authentication",
      });
    }

    // Check that user doesn't already have Google credential
    const existingGoogleCredential = await Credential.findOne({
      userId: user._id,
      type: "google",
    });

    if (existingGoogleCredential) {
      return res.status(400).json({
        message: "This account already has Google authentication linked",
      });
    }

    // Check if this Google account is already linked to another user
    const googleCredentialExists = await Credential.findOne({
      type: "google",
      provider: "google",
      providerUserId: tokenInfo.sub,
    });

    if (googleCredentialExists) {
      return res.status(400).json({
        message: "This Google account is already linked to another account",
      });
    }

    // Verify OTP
    const isValidOTP = await otpService.verifyAndConsumeOTP(
      user._id.toString(),
      otp,
    );

    if (!isValidOTP) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Create Google credential and link to password account
    await Credential.create({
      userId: user._id,
      type: "google",
      provider: "google",
      providerUserId: tokenInfo.sub,
      providerEmail: tokenInfo.email,
      metadata: {
        name: tokenInfo.name,
        picture: tokenInfo.picture,
        linkedAt: new Date(),
        accountLinking: true,
      },
    });

    // Update user profile with Google info if needed
    const profileUpdated = await updateUserProfileFromGoogle(user, tokenInfo);

    // Log account linking event for security
    console.log(
      `Google linking: Google account linked to password account user ${user._id} (${email})`,
    );

    // Generate tokens
    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    // Return tokens and user data
    res.status(200).json({
      message: "Google account linked successfully to your password account",
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        emailVerified: user.emailVerified,
        profile: user.profile,
      },
      accountLinking: {
        isNewUser: false,
        isLinkedAccount: true,
        profileUpdated,
      },
    });
  } catch (err) {
    console.error("Verify Google link error:", err);

    const errorMessage = err instanceof Error ? err.message : "Server error";
    const statusCode =
      errorMessage.includes("Invalid") || errorMessage.includes("not verified")
        ? 400
        : 500;

    res.status(statusCode).json({ message: errorMessage });
  }
};

// Helper function to update user profile with Google information
const updateUserProfileFromGoogle = async (
  user: any,
  tokenInfo: any,
): Promise<boolean> => {
  let profileUpdated = false;

  // Ensure profile object exists
  if (!user.profile) {
    user.profile = {
      firstName: "",
      lastName: "",
      avatarUrl: "",
    };
  }

  // Update profile data if current data is empty/default
  if (tokenInfo.name) {
    const [firstName, ...lastNameParts] = tokenInfo.name.split(" ");

    if (!user.profile.firstName || user.profile.firstName === "User") {
      user.profile.firstName = firstName;
      profileUpdated = true;
    }

    if (!user.profile.lastName && lastNameParts.length > 0) {
      user.profile.lastName = lastNameParts.join(" ");
      profileUpdated = true;
    }
  }

  if (!user.profile.avatarUrl && tokenInfo.picture) {
    user.profile.avatarUrl = tokenInfo.picture;
    profileUpdated = true;
  }

  // Update email verification status if not already verified
  if (!user.emailVerified) {
    user.emailVerified = true;
    profileUpdated = true;
  }

  if (profileUpdated) {
    await user.save();
  }

  return profileUpdated;
};
