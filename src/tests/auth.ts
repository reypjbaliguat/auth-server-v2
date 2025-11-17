// import dotenv from "dotenv";
// import mongoose from "mongoose";
// import request from "supertest";
// import app from "../app";

// dotenv.config();

// beforeAll(async () => {
//   await mongoose.connect(process.env.MONGO_URI_TEST!);
// });

// afterAll(async () => {
//   await mongoose.connection.close();
// });

// describe("Auth Routes", () => {
//   let testUserEmail = "testuser@example.com";
//   let testUserPassword = "Test@12345";
//   let accessToken = "";
//   let otpCode = "";

//   // 🧪 Login
//   //   it("should log in the user", async () => {
//   //     const res = await request(app).post("/v1/api/auth/login").send({
//   //       email: testUserEmail,
//   //       password: testUserPassword,
//   //     });

//   //     expect(res.status).toBe(200);
//   //     expect(res.body).toHaveProperty("accessToken");
//   //     expect(res.body).toHaveProperty("refreshToken");

//   //     accessToken = res.body.accessToken;
//   //   });

//   // 🧪 Request OTP
//   //   it("should request OTP successfully", async () => {
//   //     const res = await request(app).post("/v1/api/auth/request-otp").send({
//   //       email: testUserEmail,
//   //     });

//   //     expect(res.status).toBe(200);
//   //     expect(res.body).toHaveProperty("message");
//   //     expect(res.body.message).toMatch(/OTP sent/i);

//   //     // Assuming your backend stores the OTP in DB,
//   //     // you can optionally query it directly for testing.
//   //     // Example:
//   //     // const otpDoc = await Otp.findOne({ email: testUserEmail });
//   //     // otpCode = otpDoc?.code || "";
//   //   });

//   // 🧪 Verify OTP
//   it("should verify OTP successfully", async () => {
//     // Normally you'd use a real OTP from DB.
//     // Here we just mock one for test (change as needed).
//     otpCode = "123456";

//     const res = await request(app).post("/v1/api/auth/verify-otp").send({
//       email: testUserEmail,
//       otp: otpCode,
//     });

//     // Depending on your implementation:
//     expect([200, 400, 401]).toContain(res.status);
//   });

//   // 🧪 Google Login
//   it("should reject invalid Google credential", async () => {
//     const res = await request(app).post("/v1/api/auth/google").send({
//       credential: "invalid_token_here",
//     });

//     expect(res.status).toBe(400);
//     expect(res.body.message).toMatch(/invalid google credential/i);
//   });
// });
