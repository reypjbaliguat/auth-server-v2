import request from "supertest";
import app from "../../../app";
import OTP from "../../../models/OTP";
import User from "../../../models/User";
import "../../../tests/setup/db";
import * as sendEmailModule from "../../../utils/sendEmail";

jest.mock("../../../utils/sendEmail");
const mockSendEmail = jest.mocked(sendEmailModule.sendEmail);

describe("Auth Routes - OTP status and resend", () => {
  const email = "otp.status@test.com";

  beforeEach(() => {
    mockSendEmail.mockReset();
    mockSendEmail.mockResolvedValue({ id: "email-id" } as any);
  });

  it("GET /otp-status/:email returns 404 when user is missing", async () => {
    const res = await request(app).get(
      `/v1/api/auth/otp-status/nobody-${Date.now()}@test.com`,
    );
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("User not found");
  });

  it("GET /otp-status/:email returns canResend when no active OTP", async () => {
    await User.create({ email });

    const res = await request(app).get(`/v1/api/auth/otp-status/${email}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ canResend: true });
  });

  it("POST /resend-otp returns 400 when email is missing", async () => {
    const res = await request(app).post("/v1/api/auth/resend-otp").send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Email is required");
  });

  it("POST /resend-otp returns 404 when user is missing", async () => {
    const res = await request(app)
      .post("/v1/api/auth/resend-otp")
      .send({ email: "missing@test.com" });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("User not found");
  });

  it("POST /resend-otp returns 429 during cooldown", async () => {
    const user = await User.create({ email });
    await OTP.create({
      userId: user._id,
      otpHash: "dummy-hash",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      used: false,
      lastSentAt: new Date(),
    });

    const res = await request(app)
      .post("/v1/api/auth/resend-otp")
      .send({ email });

    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/wait/i);
    expect(res.body).toHaveProperty("canResendAt");
  });

  it("POST /resend-otp succeeds when cooldown allows", async () => {
    const user = await User.create({ email: "resend.ok@test.com" });
    const old = new Date(Date.now() - 70_000);
    await OTP.create({
      userId: user._id,
      otpHash: "dummy-hash",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      used: false,
      lastSentAt: old,
    });

    const res = await request(app)
      .post("/v1/api/auth/resend-otp")
      .send({ email: "resend.ok@test.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/OTP sent successfully/i);
    expect(mockSendEmail).toHaveBeenCalled();
  });
});
