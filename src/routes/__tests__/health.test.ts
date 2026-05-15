import request from "supertest";
import app from "../../app"; // Make sure app.ts exports your Express app

describe("Health Check", () => {
  it("should return OK", async () => {
    const res = await request(app).get("/v1/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("OK");
    expect(res.body.timestamp).toEqual(expect.any(String));
  });
});
