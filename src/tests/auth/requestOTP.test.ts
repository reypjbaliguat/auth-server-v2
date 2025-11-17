import request from "supertest";
import app from "../../app";
import Credential from "../../models/Credential";
import User from "../../models/User";
import { hashPassword } from "../../utils/hashPassword";
import "../setup/db";

jest.mock("../../utils/sendEmail", () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

describe("Auth Routes - Request OTP", () => {
  let userEmail = "javapisonet1@gmail.com";
  let userPassword = "TestPassword123";

  beforeEach(async () => {
    // Clean DB already handled by setup/db
    // But create a fresh user for every test
    const passwordHash = await hashPassword(userPassword);

    const user = await User.create({ email: userEmail });
    await Credential.create({ userId: user._id, passwordHash });
  });
  it("should return a message saying User not found if email does not exist", async () => {
    // check db
    const res = await request(app).post("/v1/api/auth/request-otp").send({
      email: "test@gmail.com",
      password: userPassword,
    });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toMatch(/User not found/i);
  });
  it("should return a message invalid password if user input invalid password", async () => {
    const res = await request(app).post("/v1/api/auth/request-otp").send({
      email: userEmail,
      password: "invalidpassword123",
    });
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toMatch(/Invalid|password|credentials/i);
  });
  it("should return a message OTP sent to your email", async () => {
    const res = await request(app).post("/v1/api/auth/request-otp").send({
      email: userEmail,
      password: userPassword,
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toMatch(/OTP sent to your email/i);
  });
});
