import axios from "axios";
import { Request, Response } from "express";
import Credential from "../models/Credential";
import OTP from "../models/OTP";
import User from "../models/User";
import { createOTP, verifyOTP } from "../utils/generateOTP";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/generateToken";
import { comparePassword, hashPassword } from "../utils/hashPassword";
import { sendEmail } from "../utils/sendEmail";

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      // Check if they only have social login (no password set)
      const hasPassword = await Credential.findOne({
        userId: existing._id,
        type: "password",
      });
      if (!hasPassword) {
        // User exists with social login only, allow adding password
        const passwordHash = await hashPassword(password);
        await Credential.create({
          userId: existing._id,
          passwordHash,
          type: "password",
        });
        return res.status(200).json({
          message: "Password added to your existing account successfully",
        });
      }
      return res
        .status(400)
        .json({ message: "Email already exists with password login" });
    }

    const user = await User.create({ email });
    const passwordHash = await hashPassword(password);

    await Credential.create({
      userId: user._id,
      passwordHash,
      type: "password",
    });
    // Check for existing valid OTP first
    let existingOTP = await OTP.findOne({
      userId: user._id,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    let otp: string;

    if (existingOTP) {
      // Reuse existing OTP - generate new OTP and update record
      const { otp: newOtp, hash: newHash } = await createOTP();
      existingOTP.otpHash = newHash;
      existingOTP.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      await existingOTP.save();
      otp = newOtp;
    } else {
      // Create new OTP
      const { otp: newOtp, hash } = await createOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      await OTP.create({ userId: user._id, otpHash: hash, expiresAt });
      otp = newOtp;
    }

    await sendEmail(
      user.email,
      "Your Login OTP",
      `Your verification code is ${otp}`
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

    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: "User not found" });

    const credential = await Credential.findOne({
      userId: user._id,
      type: "password",
    });
    if (!credential)
      return res.status(400).json({ message: "Invalid credentials" });

    const valid = await comparePassword(
      password,
      credential.passwordHash ?? ""
    );
    if (!valid) return res.status(401).json({ message: "Invalid password" });

    // Check for existing valid OTP first
    let existingOTP = await OTP.findOne({
      userId: user._id,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    let otp: string;

    if (existingOTP) {
      // Reuse existing OTP - generate new OTP and update record
      const { otp: newOtp, hash: newHash } = await createOTP();
      existingOTP.otpHash = newHash;
      existingOTP.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      await existingOTP.save();
      otp = newOtp;
    } else {
      // Create new OTP
      const { otp: newOtp, hash } = await createOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      await OTP.create({ userId: user._id, otpHash: hash, expiresAt });
      otp = newOtp;
    }

    await sendEmail(
      user.email,
      "Your Login OTP",
      `Your verification code is ${otp}`
    );
    res.status(200).json({ message: "OTP sent to your email" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Step 1: Verify email + password, send OTP
export const requestOTP = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });

  const credential = await Credential.findOne({
    userId: user._id,
    type: "password",
  });
  if (!credential)
    return res.status(400).json({ message: "Invalid credentials" });

  const valid = await comparePassword(password, credential.passwordHash!);
  if (!valid) return res.status(401).json({ message: "Invalid password" });

  // Check for existing valid OTP first
  let existingOTP = await OTP.findOne({
    userId: user._id,
    used: false,
    expiresAt: { $gt: new Date() },
  });

  let otp: string;

  if (existingOTP) {
    // Reuse existing OTP - generate new OTP and update record
    const { otp: newOtp, hash: newHash } = await createOTP();
    existingOTP.otpHash = newHash;
    existingOTP.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await existingOTP.save();
    otp = newOtp;
  } else {
    // Create new OTP
    const { otp: newOtp, hash } = await createOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await OTP.create({ userId: user._id, otpHash: hash, expiresAt });
    otp = newOtp;
  }

  await sendEmail(
    user.email,
    "Your Login OTP",
    `Your verification code is ${otp}`
  );
  res.json({ message: "OTP sent to your email" });
};

// Step 2: Verify OTP
export const verifyUserOTP = async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });
  const record = await OTP.findOne({ userId: user._id, used: false });
  if (!record || record.expiresAt < new Date())
    return res.status(400).json({ message: "OTP expired or invalid" });
  const valid = await verifyOTP(otp, record.otpHash);
  if (!valid) return res.status(400).json({ message: "Incorrect OTP" });

  record.used = true;
  await record.save();

  const accessToken = generateAccessToken(user._id.toString());
  const refreshToken = generateRefreshToken(user._id.toString());

  res.status(200).json({ accessToken, refreshToken, user });
};

// Google Login
// Updated backend Google login controller
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
    const googleRes = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`,
      { timeout: 5000 } // Add timeout for external API calls
    );

    const { email, sub, name, picture, email_verified } = googleRes.data;

    // Validate required fields from Google response
    if (!email || !sub) {
      return res.status(400).json({
        message: "Invalid Google credential - missing required user data",
      });
    }

    // Only allow verified email addresses
    if (!email_verified) {
      return res.status(400).json({
        message: "Google account email is not verified",
      });
    }

    let credential = await Credential.findOne({
      type: "google",
      provider: "google",
      providerUserId: sub,
    });

    let user;
    let isNewUser = false;
    let isLinkedAccount = false;

    if (!credential) {
      // Check if user already exists with this email
      user = await User.findOne({ email });

      if (!user) {
        // Create new user
        isNewUser = true;
        user = await User.create({
          email,
          emailVerified: true,
          profile: {
            firstName: name?.split(" ")[0] || "User", // Extract first name
            lastName: name?.split(" ").slice(1).join(" ") || "", // Extract last name
            avatarUrl: picture,
          },
        });
      } else {
        // User exists but doesn't have Google provider linked
        isLinkedAccount = true;
        // Update email verification status if not already verified
        if (!user.emailVerified) {
          user.emailVerified = true;
          await user.save();
        }
      }

      // Create credential entry
      credential = await Credential.create({
        userId: user._id,
        type: "google",
        provider: "google",
        providerUserId: sub,
        providerEmail: email,
        metadata: { name, picture },
      });
    } else {
      // Existing Google credential, get user
      user = await User.findById(credential.userId);

      if (!user) {
        return res.status(400).json({
          message: "User account not found",
        });
      }
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    // Return tokens and user data with appropriate message
    const responseMessage = isNewUser
      ? "Account created successfully with Google"
      : isLinkedAccount
      ? "Google account linked to your existing account"
      : "Login successful";

    // Return tokens and user data (consistent with your OTP verification response)
    res.json({
      accessToken,
      refreshToken,
      message: responseMessage,
      user: {
        id: user._id,
        email: user.email,
        emailVerified: user.emailVerified,
        profile: user.profile,
        // Add any other user fields you need
      },
    });
  } catch (err) {
    console.error("Google login error:", err);

    // Handle different types of errors appropriately
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 400) {
        return res.status(400).json({
          message: "Invalid Google credential",
        });
      }
      return res.status(500).json({
        message: "Failed to verify Google credential",
      });
    }

    // Database or other errors
    res.status(500).json({
      message: "Authentication failed. Please try again.",
    });
  }
};
