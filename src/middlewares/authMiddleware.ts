import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { sendUnauthorized } from "../utils/authErrors";

interface AccessClaims {
  userId: string;
  iat?: number;
  exp?: number;
}

declare module "express-serve-static-core" {
  interface Request {
    authUserId?: string;
  }
}

export const requireAccessToken = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.header("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return sendUnauthorized(res);
  }

  const token = authHeader.slice(7).trim();

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || "",
    ) as AccessClaims;
    req.authUserId = payload.userId;
    next();
  } catch {
    return sendUnauthorized(res);
  }
};
