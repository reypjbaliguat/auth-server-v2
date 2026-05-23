import crypto from "crypto";
import jwt from "jsonwebtoken";
import RefreshSession from "../models/RefreshSession";
import { generateRefreshToken } from "../utils/generateToken";

interface RefreshClaims {
  userId: string;
  jti: string;
  familyId: string;
  iat?: number;
  exp?: number;
}

const getRefreshSecret = () => process.env.REFRESH_SECRET || "";

const getRefreshTokenTtlDays = () =>
  Number(process.env.REFRESH_TOKEN_TTL_DAYS || "7");

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const calculateExpiryDate = () => {
  const configuredTtl = getRefreshTokenTtlDays();
  const ttlDays =
    Number.isFinite(configuredTtl) && configuredTtl > 0 ? configuredTtl : 7;

  return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
};

const verifyRefreshToken = (token: string): RefreshClaims | null => {
  try {
    const refreshSecret = getRefreshSecret();
    if (!refreshSecret) {
      return null;
    }

    return jwt.verify(token, refreshSecret) as RefreshClaims;
  } catch {
    return null;
  }
};

const issueSession = async (userId: string, familyId?: string) => {
  const sessionFamilyId = familyId || crypto.randomUUID();
  const jti = crypto.randomUUID();
  const token = generateRefreshToken({
    userId,
    jti,
    familyId: sessionFamilyId,
  });

  await RefreshSession.create({
    userId,
    familyId: sessionFamilyId,
    jti,
    tokenHash: hashToken(token),
    status: "active",
    expiresAt: calculateExpiryDate(),
  });

  return { token, jti, familyId: sessionFamilyId };
};

const revokeFamily = async (familyId: string, reason: string) => {
  await RefreshSession.updateMany(
    { familyId, status: { $ne: "revoked" } },
    { status: "revoked", revokedReason: reason },
  );
};

const rotateSession = async (token: string) => {
  const claims = verifyRefreshToken(token);
  if (!claims) {
    return { success: false as const, reason: "invalid" };
  }

  const currentSession = await RefreshSession.findOne({ jti: claims.jti });

  if (!currentSession) {
    await revokeFamily(claims.familyId, "reuse_detected_missing_session");
    return { success: false as const, reason: "reuse" };
  }

  const incomingHash = hashToken(token);

  if (currentSession.tokenHash !== incomingHash) {
    await revokeFamily(claims.familyId, "reuse_detected_hash_mismatch");
    return { success: false as const, reason: "reuse" };
  }

  if (currentSession.status !== "active") {
    await revokeFamily(claims.familyId, "reuse_detected_rotated_or_revoked");
    return { success: false as const, reason: "reuse" };
  }

  if (currentSession.expiresAt.getTime() <= Date.now()) {
    await RefreshSession.updateOne(
      { _id: currentSession._id },
      { status: "revoked", revokedReason: "expired" },
    );
    return { success: false as const, reason: "invalid" };
  }

  const next = await issueSession(claims.userId, claims.familyId);

  await RefreshSession.updateOne(
    { _id: currentSession._id },
    {
      status: "rotated",
      replacedByJti: next.jti,
      revokedReason: "rotated",
    },
  );

  return {
    success: true as const,
    userId: claims.userId,
    token: next.token,
  };
};

const revokeByToken = async (token: string) => {
  const claims = verifyRefreshToken(token);
  if (!claims) {
    return;
  }

  await RefreshSession.updateOne(
    { jti: claims.jti },
    { status: "revoked", revokedReason: "logout" },
  );
};

export const refreshTokenService = {
  issueSession,
  rotateSession,
  revokeByToken,
};
