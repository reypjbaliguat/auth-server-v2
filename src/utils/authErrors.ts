import { Response } from "express";

export const TOKEN_INVALID_CODE = "TOKEN_INVALID_OR_EXPIRED";

export const sendUnauthorized = (res: Response) => {
  return res.status(401).json({
    message: "Unauthorized",
    code: TOKEN_INVALID_CODE,
  });
};
