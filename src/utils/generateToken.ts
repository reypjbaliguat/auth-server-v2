import jwt from "jsonwebtoken";

const ACCESS_TOKEN_TTL =
  (process.env.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"]) || "15m";

export const generateAccessToken = (userId: string) => {
  const jwtSecret = process.env.JWT_SECRET || "";
  return jwt.sign({ userId }, jwtSecret, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
};

export const generateRefreshToken = (payload: {
  userId: string;
  jti: string;
  familyId: string;
}) => {
  const refreshSecret = process.env.REFRESH_SECRET || "";
  const refreshTtlDays = process.env.REFRESH_TOKEN_TTL_DAYS || "7";
  const refreshExpiresIn = `${refreshTtlDays}d` as jwt.SignOptions["expiresIn"];

  return jwt.sign(payload, refreshSecret, {
    expiresIn: refreshExpiresIn,
  });
};
