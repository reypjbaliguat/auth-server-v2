import request from "supertest";
import app from "../../app";
import Credential from "../../models/Credential";
import User from "../../models/User";
import { hashPassword } from "../../utils/hashPassword";
import "../setup/db";

describe("Auth Routes - Login", () => {
  const testUserEmail = "test@gmail.com";
  const testUserPassword = "TestPassword123";

  beforeEach(async () => {
    // Clean DB already handled by setup/db
    // But create a fresh user for every test
    const passwordHash = await hashPassword(testUserPassword);

    const user = await User.create({ email: testUserEmail });
    await Credential.create({ userId: user._id, passwordHash });
  });

  it("should send user not found if email doesn't exist", async () => {
    const res = await request(app).post("/v1/api/auth/login").send({
      email: "nonexistent@gmail.com",
      password: testUserPassword,
    });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toMatch(/User not found/i);
  });
  it("should send invalid password if password is wrong", async () => {
    const res = await request(app).post("/v1/api/auth/login").send({
      email: testUserEmail,
      password: "WrongPassword123",
    });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toMatch(/Invalid password/i);
  });
  it("should login successfully and return tokens", async () => {
    const res = await request(app).post("/v1/api/auth/login").send({
      email: testUserEmail,
      password: testUserPassword,
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
  });
});
