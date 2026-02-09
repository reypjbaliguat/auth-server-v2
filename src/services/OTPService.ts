import OTP from "../models/OTP";
import { createOTP } from "../utils/generateOTP";
import { sendEmail } from "../utils/sendEmail";

/**
 * Generates and sends OTP to user's email
 * Handles existing OTP reuse or creates new one
 */
const generateAndSendOTP = async (
  userId: string,
  email: string,
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
    existingOTP.lastSentAt = new Date();
    await existingOTP.save();
    otp = newOtp;
  } else {
    // Create new OTP
    const { otp: newOtp, hash } = await createOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await OTP.create({
      userId,
      otpHash: hash,
      expiresAt,
      lastSentAt: new Date(),
    });
    otp = newOtp;
  }

  await sendEmail(email, "Your Login OTP", `Your verification code is ${otp}`);
};

/**
 * Verifies OTP and marks it as used
 */
const verifyAndConsumeOTP = async (
  userId: string,
  otpCode: string,
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

/**
 * Gets OTP status for a user - can they resend and when
 */
const getOTPStatus = async (
  userId: string,
): Promise<{
  canResend: boolean;
  remainingTime?: number;
  canResendAt?: number;
}> => {
  const RESEND_COOLDOWN = 60; // 60 seconds cooldown

  const activeOTP = await OTP.findOne({
    userId,
    used: false,
    expiresAt: { $gt: new Date() },
  });

  if (!activeOTP) {
    return { canResend: true };
  }

  const now = Date.now();
  const lastSentAt = activeOTP.lastSentAt.getTime();
  const timeSinceLastSent = Math.floor((now - lastSentAt) / 1000);

  if (timeSinceLastSent >= RESEND_COOLDOWN) {
    return { canResend: true };
  }

  const remainingTime = RESEND_COOLDOWN - timeSinceLastSent;
  const canResendAt = Math.floor((lastSentAt + RESEND_COOLDOWN * 1000) / 1000);

  return {
    canResend: false,
    remainingTime,
    canResendAt,
  };
};

/**
 * Resends OTP if cooldown period has passed
 */
const resendOTP = async (
  userId: string,
  email: string,
): Promise<{
  success: boolean;
  message: string;
  canResendAt?: number;
}> => {
  const status = await getOTPStatus(userId);

  if (!status.canResend) {
    return {
      success: false,
      message: "Please wait before requesting another OTP",
      canResendAt: status.canResendAt,
    };
  }

  await generateAndSendOTP(userId, email);

  const RESEND_COOLDOWN = 60; // 60 seconds
  const canResendAt = Math.floor((Date.now() + RESEND_COOLDOWN * 1000) / 1000);

  return {
    success: true,
    message: "OTP sent successfully",
    canResendAt,
  };
};

export const otpService = {
  generateAndSendOTP,
  verifyAndConsumeOTP,
  getOTPStatus,
  resendOTP,
};
