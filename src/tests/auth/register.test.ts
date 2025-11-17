import request from "supertest";
import app from "../../app";
import User from "../../models/User";
import "../setup/db";

describe("Auth Routes - Register", () => {
  const testUserEmail = "test.register@gmail.com";
  const testUserPassword = "TestPassword123";

  it("should register a new user", async () => {
    const res = await request(app).post("/v1/api/auth/register").send({
      email: testUserEmail,
      password: testUserPassword,
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("message");

    const user = await User.findOne({ email: testUserEmail }).lean();
    expect(user).not.toBeNull();
  });

  it("should not register an existing user", async () => {
    // create user first
    await User.create({ email: testUserEmail, password: testUserPassword });

    const res = await request(app).post("/v1/api/auth/register").send({
      email: testUserEmail,
      password: testUserPassword,
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message");
  });
});
