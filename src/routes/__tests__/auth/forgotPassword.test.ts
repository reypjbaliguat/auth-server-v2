import request from "supertest";
import app from "../../../app";
import Credential from "../../../models/Credential";
import OTP from "../../../models/OTP";
import User from "../../../models/User";
import "../../../tests/setup/db";
import { createOTP } from "../../../utils/generateOTP";
import { hashPassword } from "../../../utils/hashPassword";
import * as sendEmailModule from "../../../utils/sendEmail";

// Mock the sendEmail function
jest.mock("../../../utils/sendEmail");
const mockSendEmail = jest.mocked(sendEmailModule.sendEmail);

describe("Auth Routes - Forgot Password", () => {
  const testUserEmail = "test@gmail.com";
  const testUserPassword = "TestPassword123";
  const socialUserEmail = "social@gmail.com";
  let testUserId: string;
  let socialUserId: string;

  beforeEach(async () => {
    // Clean DB already handled by setup/db
    mockSendEmail.mockReset();

    // Create a user with password credentials
    const passwordHash = await hashPassword(testUserPassword);
    const user = await User.create({ email: testUserEmail });
    testUserId = user._id.toString();
    await Credential.create({
      userId: user._id,
      passwordHash,
      type: "password",
    });

    // Create a user with only social login
    const socialUser = await User.create({ email: socialUserEmail });
    socialUserId = socialUser._id.toString();
    await Credential.create({
      userId: socialUser._id,
      type: "google",
      provider: "google",
      providerUserId: "google123",
      providerEmail: socialUserEmail,
    });
  });

  describe("POST /forgot-password", () => {
    it("should return error if email is not provided", async () => {
      const res = await request(app)
        .post("/v1/api/auth/forgot-password")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Email is required");
    });

    it("should return error if user does not exist", async () => {
      const res = await request(app)
        .post("/v1/api/auth/forgot-password")
        .send({ email: "nonexistent@gmail.com" });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("User not found");
    });

    it("should return error for social login only accounts", async () => {
      const res = await request(app)
        .post("/v1/api/auth/forgot-password")
        .send({ email: socialUserEmail });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        "This account uses social login. Please sign in with your social account.",
      );
    });

    it("should successfully send password reset OTP for valid user", async () => {
      mockSendEmail.mockResolvedValueOnce({ id: "email-id" } as any);

      const res = await request(app)
        .post("/v1/api/auth/forgot-password")
        .send({ email: testUserEmail });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Password reset code sent to your email");

      // Verify OTP was created
      const otp = await OTP.findOne({ userId: testUserId });
      expect(otp).toBeTruthy();
      expect(otp?.used).toBe(false);

      // Verify email was sent
      expect(mockSendEmail).toHaveBeenCalledWith(
        testUserEmail,
        "Password Reset Request",
        expect.stringContaining("We received a request to reset your password"),
      );
    });

    it("should handle server errors gracefully", async () => {
      mockSendEmail.mockRejectedValueOnce(new Error("Email service failed"));

      const res = await request(app)
        .post("/v1/api/auth/forgot-password")
        .send({ email: testUserEmail });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Server error");
    });
  });

  describe("POST /reset-password", () => {
    let validOTP: string;
    let validOTPHash: string;

    beforeEach(async () => {
      // Create a valid OTP for testing
      const { otp, hash } = await createOTP();
      validOTP = otp;
      validOTPHash = hash;

      await OTP.create({
        userId: testUserId,
        otpHash: validOTPHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        used: false,
      });
    });

    it("should return error if required fields are missing", async () => {
      const res = await request(app)
        .post("/v1/api/auth/reset-password")
        .send({ email: testUserEmail });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        "Email, OTP, and new password are required",
      );
    });

    it("should return error if user does not exist", async () => {
      const res = await request(app).post("/v1/api/auth/reset-password").send({
        email: "nonexistent@gmail.com",
        otp: validOTP,
        newPassword: "NewPassword123",
      });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("User not found");
    });

    it("should return error for invalid OTP", async () => {
      const res = await request(app).post("/v1/api/auth/reset-password").send({
        email: testUserEmail,
        otp: "123456",
        newPassword: "NewPassword123",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid or expired OTP");
    });

    it("should return error for expired OTP", async () => {
      // Create expired OTP
      await OTP.deleteMany({ userId: testUserId });
      const { otp: expiredOtp, hash: expiredHash } = await createOTP();
      await OTP.create({
        userId: testUserId,
        otpHash: expiredHash,
        expiresAt: new Date(Date.now() - 1000), // Expired
        used: false,
      });

      const res = await request(app).post("/v1/api/auth/reset-password").send({
        email: testUserEmail,
        otp: expiredOtp,
        newPassword: "NewPassword123",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid or expired OTP");
    });

    it("should return error for social login only accounts", async () => {
      // Create OTP for social user (shouldn't be possible in real scenario)
      const { otp, hash } = await createOTP();
      await OTP.create({
        userId: socialUserId,
        otpHash: hash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        used: false,
      });

      const res = await request(app).post("/v1/api/auth/reset-password").send({
        email: socialUserEmail,
        otp: otp,
        newPassword: "NewPassword123",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        "This account uses social login. Cannot reset password.",
      );
    });

    it("should successfully reset password with valid OTP", async () => {
      const newPassword = "NewPassword123";

      const res = await request(app).post("/v1/api/auth/reset-password").send({
        email: testUserEmail,
        otp: validOTP,
        newPassword: newPassword,
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Password reset successfully");

      // Verify OTP was marked as used
      const usedOTP = await OTP.findOne({ userId: testUserId });
      expect(usedOTP?.used).toBe(true);

      // Verify password was updated by trying to login with new password
      const loginRes = await request(app).post("/v1/api/auth/login").send({
        email: testUserEmail,
        password: newPassword,
      });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.message).toMatch(/OTP sent to your email/i);
    });

    it("should not allow reusing the same OTP", async () => {
      // Use OTP once
      await request(app).post("/v1/api/auth/reset-password").send({
        email: testUserEmail,
        otp: validOTP,
        newPassword: "NewPassword123",
      });

      // Try to use same OTP again
      const res = await request(app).post("/v1/api/auth/reset-password").send({
        email: testUserEmail,
        otp: validOTP,
        newPassword: "AnotherPassword123",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid or expired OTP");
    });
  });
});
