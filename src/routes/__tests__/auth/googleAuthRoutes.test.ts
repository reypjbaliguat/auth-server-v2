import request from "supertest";
import app from "../../../app";
import Credential from "../../../models/Credential";
import OTP from "../../../models/OTP";
import User from "../../../models/User";
import { googleAuthService } from "../../../services/GoogleAuthService";
import "../../../tests/setup/db";
import { createOTP } from "../../../utils/generateOTP";
import { hashPassword } from "../../../utils/hashPassword";
import * as sendEmailModule from "../../../utils/sendEmail";

jest.mock("../../../services/GoogleAuthService");
jest.mock("../../../utils/sendEmail");
jest.mock("../../../utils/generateToken", () => ({
  generateAccessToken: jest.fn(() => "mockAccessToken"),
  generateRefreshToken: jest.fn(() => "mockRefreshToken"),
}));

const mockGoogle = googleAuthService as jest.Mocked<typeof googleAuthService>;
const mockSendEmail = jest.mocked(sendEmailModule.sendEmail);

describe("Auth Routes - Google login", () => {
  beforeEach(() => {
    mockSendEmail.mockReset();
    mockSendEmail.mockResolvedValue({ id: "email-id" } as any);
    jest.clearAllMocks();
  });

  it("returns 400 when credential is missing", async () => {
    const res = await request(app).post("/v1/api/auth/google-login").send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Google credential is required");
  });

  it("returns 200 with tokens when Google login succeeds", async () => {
    const user = await User.create({
      email: "gl@test.com",
      emailVerified: true,
    });
    mockGoogle.verifyGoogleToken.mockResolvedValue({
      email: "gl@test.com",
      sub: "google-sub-unique-1",
      email_verified: true,
    });
    mockGoogle.processGoogleLogin.mockResolvedValue({
      user,
      message: "Login successful",
      metadata: {
        isNewUser: false,
        isLinkedAccount: false,
        profileUpdated: false,
      },
    } as any);

    const res = await request(app)
      .post("/v1/api/auth/google-login")
      .send({ credential: "fake-jwt" });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe("mockAccessToken");
    expect(res.body.refreshToken).toBeUndefined();
    expect(String(res.headers["set-cookie"])).toContain(
      "refreshToken=mockRefreshToken",
    );
    expect(res.body.message).toBe("Login successful");
    expect(mockGoogle.verifyGoogleToken).toHaveBeenCalledWith("fake-jwt");
    expect(mockGoogle.processGoogleLogin).toHaveBeenCalled();
  });

  it("returns EMAIL_EXISTS_PASSWORD when a password account exists for that email", async () => {
    const passwordHash = await hashPassword("Pass12345!");
    const u = await User.create({ email: "exists@test.com" });
    await Credential.create({
      userId: u._id,
      passwordHash,
      type: "password",
    });

    mockGoogle.verifyGoogleToken.mockResolvedValue({
      email: "exists@test.com",
      sub: "google-new-sub-99",
      email_verified: true,
    });

    const res = await request(app)
      .post("/v1/api/auth/google-login")
      .send({ credential: "fake-jwt" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("EMAIL_EXISTS_PASSWORD");
    expect(mockGoogle.processGoogleLogin).not.toHaveBeenCalled();
  });
});

describe("Auth Routes - Link Google to password account", () => {
  beforeEach(() => {
    mockSendEmail.mockReset();
    mockSendEmail.mockResolvedValue({ id: "email-id" } as any);
    jest.clearAllMocks();
  });

  it("returns 400 when Google email does not match provided email", async () => {
    mockGoogle.verifyGoogleToken.mockResolvedValue({
      email: "google@gmail.com",
      sub: "sub-a",
      email_verified: true,
    });

    const res = await request(app)
      .post("/v1/api/auth/link-google-account")
      .send({ credential: "token", email: "other@test.com" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/does not match/i);
  });

  it("sends OTP when linking Google to an existing password account", async () => {
    const passwordHash = await hashPassword("Pass12345!");
    const user = await User.create({ email: "linkg@test.com" });
    await Credential.create({
      userId: user._id,
      passwordHash,
      type: "password",
    });

    mockGoogle.verifyGoogleToken.mockResolvedValue({
      email: "linkg@test.com",
      sub: "google-to-link-1",
      email_verified: true,
    });

    const res = await request(app)
      .post("/v1/api/auth/link-google-account")
      .send({ credential: "token", email: "linkg@test.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/OTP sent/i);
    expect(mockSendEmail).toHaveBeenCalled();
  });

  it("links Google after OTP verification", async () => {
    const passwordHash = await hashPassword("Pass12345!");
    const user = await User.create({ email: "verifyg@test.com" });
    await Credential.create({
      userId: user._id,
      passwordHash,
      type: "password",
    });

    const { otp, hash } = await createOTP();
    await OTP.create({
      userId: user._id,
      otpHash: hash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      used: false,
      lastSentAt: new Date(),
    });

    mockGoogle.verifyGoogleToken.mockResolvedValue({
      email: "verifyg@test.com",
      sub: "google-final-sub-2",
      email_verified: true,
    });

    const res = await request(app)
      .post("/v1/api/auth/verify-google-link")
      .send({
        credential: "token",
        email: "verifyg@test.com",
        otp,
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/linked successfully/i);
    const googleCred = await Credential.findOne({
      userId: user._id,
      type: "google",
    });
    expect(googleCred).not.toBeNull();
    expect(googleCred?.providerUserId).toBe("google-final-sub-2");
  });
});
