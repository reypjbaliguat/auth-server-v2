import bcrypt from "bcryptjs";
import request from "supertest";
import app from "../../app";
import OTP from "../../models/OTP";
import User from "../../models/User";

import "../setup/db";

// mock token generation to avoid using real JWT
jest.mock("../../utils/generateToken", () => ({
  generateAccessToken: jest.fn(() => "mockAccessToken"),
  generateRefreshToken: jest.fn(() => "mockRefreshToken"),
}));

const testEmail = "verify@test.com";
const testPassword = "Password123";

describe("Auth Routes - Verify OTP", () => {
  let user: any;
  let otpPlain: string;
  let otpHash: string;

  beforeEach(async () => {
    // 1. Create user
    user = await User.create({
      email: testEmail,
      password: testPassword,
    });

    otpPlain = "123456";

    // MUST MATCH REAL IMPLEMENTATION
    otpHash = await bcrypt.hash(otpPlain, 10);

    await OTP.create({
      userId: user._id,
      otpHash,
      used: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });
  });

  // -------------------------------
  // USER NOT FOUND
  // -------------------------------
  it("should return 404 if user does not exist", async () => {
    const res = await request(app)
      .post("/v1/api/auth/verify-otp")
      .send({ email: "doesnotexist@test.com", otp: "111111" });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/User not found/i);
  });

  // -------------------------------
  // EXPIRED OR INVALID RECORD
  // -------------------------------
  it("should return 400 if OTP record is missing or expired", async () => {
    await OTP.deleteMany({}); // remove OTP to simulate missing record

    const res = await request(app)
      .post("/v1/api/auth/verify-otp")
      .send({ email: testEmail, otp: otpPlain });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired|invalid/i);
  });

  // -------------------------------
  // INCORRECT OTP
  // -------------------------------
  it("should return 400 for incorrect otp", async () => {
    const res = await request(app)
      .post("/v1/api/auth/verify-otp")
      .send({ email: testEmail, otp: "999999" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/incorrect/i);
  });

  // -------------------------------
  // SUCCESSFUL OTP
  // -------------------------------
  it("should verify OTP successfully and return tokens", async () => {
    const res = await request(app)
      .post("/v1/api/auth/verify-otp")

      .send({ email: testEmail, otp: otpPlain });
    console.log("otpPlain:", otpPlain);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken", "mockAccessToken");
    expect(res.body).toHaveProperty("refreshToken", "mockRefreshToken");

    // verify otp is marked used
    const updatedRecord = await OTP.findOne({ userId: user._id });
    expect(updatedRecord?.used).toBe(true);
  });
});
