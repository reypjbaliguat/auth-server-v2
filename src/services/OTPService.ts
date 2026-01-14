import OTP from "../models/OTP";
import { createOTP } from "../utils/generateOTP";
import { sendEmail } from "../utils/sendEmail";

/**
 * Generates and sends OTP to user's email
 * Handles existing OTP reuse or creates new one
 */
const generateAndSendOTP = async (
  userId: string,
  email: string
): Promise<void> => {
  // Check for existing valid OTP first
  let existingOTP = await OTP.findOne({
    userId,
    used: false,
    expiresAt: { $gt: new Date() },
  });

  let otp: string;

  if (existingOTP) {
    // Reuse existing OTP - generate new OTP and update record
    const { otp: newOtp, hash: newHash } = await createOTP();
    existingOTP.otpHash = newHash;
    existingOTP.expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await existingOTP.save();
    otp = newOtp;
  } else {
    // Create new OTP
    const { otp: newOtp, hash } = await createOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await OTP.create({ userId, otpHash: hash, expiresAt });
    otp = newOtp;
  }

  await sendEmail(email, "Your Login OTP", `Your verification code is ${otp}`);
};

/**
 * Verifies OTP and marks it as used
 */
const verifyAndConsumeOTP = async (
  userId: string,
  otpCode: string
): Promise<boolean> => {
  const record = await OTP.findOne({ userId, used: false });

  if (!record || record.expiresAt < new Date()) {
    return false;
  }

  const { verifyOTP } = await import("../utils/generateOTP");
  const valid = await verifyOTP(otpCode, record.otpHash);

  if (!valid) {
    return false;
  }

  record.used = true;
  await record.save();

  return true;
};

export const otpService = {
  generateAndSendOTP,
  verifyAndConsumeOTP,
};
