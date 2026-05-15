import request from "supertest";
import app from "../../../app";
import Credential from "../../../models/Credential";
import User from "../../../models/User";
import "../../../tests/setup/db";
import { hashPassword } from "../../../utils/hashPassword";
import * as sendEmailModule from "../../../utils/sendEmail";

jest.mock("../../../utils/sendEmail");
const mockSendEmail = jest.mocked(sendEmailModule.sendEmail);

describe("Auth Routes - Register", () => {
  const testUserEmail = "test.register@gmail.com";
  const testUserPassword = "TestPassword123";

  beforeEach(() => {
    mockSendEmail.mockReset();
    mockSendEmail.mockResolvedValue({ id: "email-id" } as any);
  });

  it("should register a new user", async () => {
    const res = await request(app).post("/v1/api/auth/register").send({
      email: testUserEmail,
      password: testUserPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toMatch(/OTP sent to your email/i);

    const user = await User.findOne({ email: testUserEmail }).lean();
    expect(user).not.toBeNull();
  });

  it("should reject registration when email already has password login", async () => {
    const passwordHash = await hashPassword(testUserPassword);
    const user = await User.create({ email: testUserEmail });
    await Credential.create({
      userId: user._id,
      passwordHash,
      type: "password",
    });

    const res = await request(app).post("/v1/api/auth/register").send({
      email: testUserEmail,
      password: "AnotherPassword123",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Email already exists/i);
  });

  it("returns 400 when email is Google-only (HAS_GOOGLE_ACCOUNT)", async () => {
    const user = await User.create({ email: "google.only.reg@test.com" });
    await Credential.create({
      userId: user._id,
      type: "google",
      provider: "google",
      providerUserId: "sub-reg-1",
      providerEmail: "google.only.reg@test.com",
    });

    const res = await request(app).post("/v1/api/auth/register").send({
      email: "google.only.reg@test.com",
      password: "TryPass123!",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("HAS_GOOGLE_ACCOUNT");
  });
});
