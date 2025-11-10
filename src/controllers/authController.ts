import axios from "axios";
import { Request, Response } from "express";
import AuthProvider from "../models/AuthProvider";
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
    if (existing)
      return res.status(400).json({ message: "Email already exists" });

    const user = await User.create({ email });
    const passwordHash = await hashPassword(password);

    await Credential.create({ userId: user._id, passwordHash });

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const credential = await Credential.findOne({ userId: user._id });
    if (!credential)
      return res.status(400).json({ message: "Invalid credentials" });

    const valid = await comparePassword(password, credential.passwordHash);
    if (!valid) return res.status(401).json({ message: "Invalid password" });

    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    res.json({ accessToken, refreshToken });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Step 1: Verify email + password, send OTP
export const requestOTP = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });

  const credential = await Credential.findOne({ userId: user._id });
  if (!credential)
    return res.status(400).json({ message: "Invalid credentials" });

  const valid = await comparePassword(password, credential.passwordHash);
  if (!valid) return res.status(401).json({ message: "Invalid password" });

  // Generate & store OTP
  const { otp, hash } = await createOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  await OTP.create({ userId: user._id, otpHash: hash, expiresAt });

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

  res.json({ accessToken, refreshToken });
};

// Google Login
export const googleLogin = async (req: Request, res: Response) => {
  const { credential } = req.body;
  try {
    const googleRes = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`
    );
    const { email, sub, name, picture } = googleRes.data;

    let provider = await AuthProvider.findOne({
      provider: "google",
      providerUserId: sub,
    });
    let user;

    if (!provider) {
      user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          email,
          emailVerified: true,
          profile: { firstName: name, avatarUrl: picture },
        });
      }
      provider = await AuthProvider.create({
        userId: user._id,
        provider: "google",
        providerUserId: sub,
        email,
      });
    } else {
      user = await User.findById(provider.userId);
    }

    const accessToken = generateAccessToken(user!._id.toString());
    const refreshToken = generateRefreshToken(user!._id.toString());
    res.json({ accessToken, refreshToken });
  } catch (err) {
    res.status(400).json({ message: "Invalid Google credential" });
  }
};
