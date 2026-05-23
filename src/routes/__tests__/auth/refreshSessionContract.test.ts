import request from "supertest";
import app from "../../../app";
import RefreshSession from "../../../models/RefreshSession";
import User from "../../../models/User";
import { refreshTokenService } from "../../../services/RefreshTokenService";
import "../../../tests/setup/db";
import { generateAccessToken } from "../../../utils/generateToken";

describe("Auth Routes - Refresh Session Contract", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
    process.env.REFRESH_SECRET =
      process.env.REFRESH_SECRET || "test-refresh-secret";
    process.env.REFRESH_COOKIE_PATH = "/v1/api/auth";
  });

  it("POST /refresh rotates refresh token and returns a new access token", async () => {
    const user = await User.create({ email: "refresh.success@test.com" });
    const issued = await refreshTokenService.issueSession(user._id.toString());

    const res = await request(app)
      .post("/v1/api/auth/refresh")
      .set("Cookie", [`refreshToken=${issued.token}`]);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe("refresh.success@test.com");
    expect(String(res.headers["set-cookie"])).toContain("refreshToken=");
  });

  it("POST /refresh returns standardized 401 and clears cookie for invalid token", async () => {
    const res = await request(app)
      .post("/v1/api/auth/refresh")
      .set("Cookie", ["refreshToken=invalid-token"]);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      message: "Unauthorized",
      code: "TOKEN_INVALID_OR_EXPIRED",
    });
    expect(String(res.headers["set-cookie"])).toContain("refreshToken=");
  });

  it("GET /me returns user payload with valid access token", async () => {
    const user = await User.create({ email: "me.success@test.com" });
    const accessToken = generateAccessToken(user._id.toString());

    const res = await request(app)
      .get("/v1/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("me.success@test.com");
  });

  it("POST /logout revokes session and clears cookie", async () => {
    const user = await User.create({ email: "logout.success@test.com" });
    const issued = await refreshTokenService.issueSession(user._id.toString());

    const res = await request(app)
      .post("/v1/api/auth/logout")
      .set("Cookie", [`refreshToken=${issued.token}`]);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Logged out");
    expect(String(res.headers["set-cookie"])).toContain("refreshToken=");

    const session = await RefreshSession.findOne({ jti: issued.jti });
    expect(session?.status).toBe("revoked");
  });
});
