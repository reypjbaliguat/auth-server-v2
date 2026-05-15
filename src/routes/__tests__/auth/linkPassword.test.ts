import request from "supertest";
import app from "../../../app";
import Credential from "../../../models/Credential";
import OTP from "../../../models/OTP";
import User from "../../../models/User";
import "../../../tests/setup/db";
import { createOTP } from "../../../utils/generateOTP";
import { hashPassword } from "../../../utils/hashPassword";
import * as sendEmailModule from "../../../utils/sendEmail";

jest.mock("../../../utils/sendEmail");
const mockSendEmail = jest.mocked(sendEmailModule.sendEmail);

jest.mock("../../../utils/generateToken", () => ({
  generateAccessToken: jest.fn(() => "mockAccessToken"),
  generateRefreshToken: jest.fn(() => "mockRefreshToken"),
}));

describe("Auth Routes - Link password (Google-only users)", () => {
  const googleEmail = "google.only@test.com";

  beforeEach(() => {
    mockSendEmail.mockReset();
    mockSendEmail.mockResolvedValue({ id: "email-id" } as any);
  });

  it("POST /link-password returns 400 when user has no Google credential", async () => {
    const passwordHash = await hashPassword("LocalPass123!");
    const user = await User.create({ email: "password.only@test.com" });
    await Credential.create({
      userId: user._id,
      passwordHash,
      type: "password",
    });

    const res = await request(app)
      .post("/v1/api/auth/link-password")
      .send({ email: "password.only@test.com" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Google authentication linked/i);
  });

  it("POST /link-password returns 400 when password already exists", async () => {
    const user = await User.create({ email: googleEmail });
    await Credential.create({
      userId: user._id,
      type: "google",
      provider: "google",
      providerUserId: "sub-1",
      providerEmail: googleEmail,
    });
    await Credential.create({
      userId: user._id,
      passwordHash: await hashPassword("ExistingPass123!"),
      type: "password",
    });

    const res = await request(app)
      .post("/v1/api/auth/link-password")
      .send({ email: googleEmail });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already has a password/i);
  });

  it("POST /link-password sends OTP for Google-only account", async () => {
    const user = await User.create({ email: "gonly@test.com" });
    await Credential.create({
      userId: user._id,
      type: "google",
      provider: "google",
      providerUserId: "sub-gonly",
      providerEmail: "gonly@test.com",
    });

    const res = await request(app)
      .post("/v1/api/auth/link-password")
      .send({ email: "gonly@test.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/OTP sent/i);
    expect(mockSendEmail).toHaveBeenCalled();
  });

  it("POST /verify-password-link creates password credential with valid OTP", async () => {
    const user = await User.create({ email: "verify.link@test.com" });
    await Credential.create({
      userId: user._id,
      type: "google",
      provider: "google",
      providerUserId: "sub-verify",
      providerEmail: "verify.link@test.com",
    });

    const { otp, hash } = await createOTP();
    await OTP.create({
      userId: user._id,
      otpHash: hash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      used: false,
      lastSentAt: new Date(),
    });

    const res = await request(app)
      .post("/v1/api/auth/verify-password-link")
      .send({
        email: "verify.link@test.com",
        otp,
        password: "NewSecurePass123!",
      });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe("mockAccessToken");
    expect(res.body.message).toMatch(/linked successfully/i);

    const passwordCred = await Credential.findOne({
      userId: user._id,
      type: "password",
    });
    expect(passwordCred).not.toBeNull();
  });
});
