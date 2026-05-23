import { CookieOptions, Response } from "express";

const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "refreshToken";

const parseDaysToMs = (value: string) => {
  const days = Number(value);
  if (!Number.isFinite(days) || days <= 0) {
    return 7 * 24 * 60 * 60 * 1000;
  }

  return days * 24 * 60 * 60 * 1000;
};

const getRefreshCookieOptions = (): CookieOptions => {
  const isProd = process.env.NODE_ENV === "production";
  const sameSite = (process.env.REFRESH_COOKIE_SAMESITE || "lax").toLowerCase();
  const maxAge = parseDaysToMs(process.env.REFRESH_TOKEN_TTL_DAYS || "7");

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (sameSite as "lax" | "strict" | "none") || "lax",
    path: process.env.REFRESH_COOKIE_PATH || "/v1/api/auth",
    maxAge,
  };
};

export const setRefreshCookie = (res: Response, token: string) => {
  res.cookie(REFRESH_COOKIE_NAME, token, getRefreshCookieOptions());
};

export const clearRefreshCookie = (res: Response) => {
  res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
};

export const getRefreshCookieName = () => REFRESH_COOKIE_NAME;
