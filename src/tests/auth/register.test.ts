import dotenv from "dotenv";
import request from "supertest";
import app from "../../app";
import Credential from "../../models/Credential";
import User from "../../models/User";
import "../setup/db";

dotenv.config();
let testUserEmail = "testuser@example.com";
let testUserPassword = "Test@12345";

describe("Auth Routes - Register", () => {
  // 🧪 Register
  it("should register a new user", async () => {
    const res = await request(app).post("/v1/api/auth/register").send({
      email: testUserEmail,
      password: testUserPassword,
    });
    expect(res.status).toBe(201);
    // check there is a message and it contains expected text
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toMatch(/registered|successfully|created/i);
    // confirm DB record exists

    const user = await User.findOne({ email: testUserEmail }).lean();

    expect(user).not.toBeNull();
    expect(user?.email).toBe(testUserEmail);
  });

  it("should not register an existing user", async () => {
    const res = await request(app).post("/v1/api/auth/register").send({
      email: testUserEmail,
      password: testUserPassword,
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toMatch(/already exists|duplicate|conflict/i);

    // Cleanup (important for repeated test runs)
    const user = await User.findOne({ email: testUserEmail });
    await User.deleteOne({ email: testUserEmail });
    await Credential.deleteOne({ userId: user?._id });
    console.log("Cleaned up test user and credentials in Register Test.");
  });
});
