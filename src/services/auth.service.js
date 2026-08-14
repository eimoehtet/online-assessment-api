const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const ACCESS_TOKEN_TTL = "15m";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const getConfig = () => {
  const accessSecret = process.env.JWT_SECRET;
  const refreshPepper = process.env.REFRESH_TOKEN_PEPPER;

  if (!accessSecret || !refreshPepper) {
    throw new Error("JWT_SECRET and REFRESH_TOKEN_PEPPER must be configured.");
  }

  return {
    accessSecret,
    refreshPepper,
    issuer: process.env.JWT_ISSUER || "light-lms-api",
    audience: process.env.JWT_AUDIENCE || "light-lms-web",
  };
};

const hashToken = (value) => crypto
  .createHmac("sha256", getConfig().refreshPepper)
  .update(value)
  .digest("hex");

const newOpaqueToken = () => crypto.randomBytes(48).toString("base64url");

const buildRefreshToken = (sessionId, secret) => `${sessionId}.${secret}`;

const parseRefreshToken = (value) => {
  if (typeof value !== "string") return null;
  const separator = value.indexOf(".");
  if (separator <= 0 || separator === value.length - 1) return null;
  return { sessionId: value.slice(0, separator), secret: value.slice(separator + 1) };
};

const issueAccessToken = (user, sessionId) => {
  const { accessSecret, issuer, audience } = getConfig();
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, sid: sessionId },
    accessSecret,
    { expiresIn: ACCESS_TOKEN_TTL, issuer, audience },
  );
};

const createSession = async (user) => {
  const id = crypto.randomUUID();
  const refreshSecret = newOpaqueToken();
  const csrfToken = newOpaqueToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.authSession.create({
    data: {
      id,
      user_id: user.id,
      refresh_token_hash: hashToken(buildRefreshToken(id, refreshSecret)),
      csrf_token_hash: hashToken(csrfToken),
      expiresAt,
    },
  });

  return {
    accessToken: issueAccessToken(user, id),
    refreshToken: buildRefreshToken(id, refreshSecret),
    csrfToken,
    expiresAt,
  };
};

const refreshSession = async (refreshToken, csrfToken) => {
  const parsed = parseRefreshToken(refreshToken);
  if (!parsed || !csrfToken) return null;

  const session = await prisma.authSession.findUnique({
    where: { id: parsed.sessionId },
    include: { user: true },
  });
  const now = new Date();
  const refreshHash = hashToken(refreshToken);

  if (!session || session.revokedAt || session.expiresAt <= now || session.user.status === 0) {
    return null;
  }

  if (
    !crypto.timingSafeEqual(Buffer.from(session.refresh_token_hash), Buffer.from(refreshHash)) ||
    !crypto.timingSafeEqual(Buffer.from(session.csrf_token_hash), Buffer.from(hashToken(csrfToken)))
  ) {
    await prisma.authSession.update({ where: { id: session.id }, data: { revokedAt: now } });
    return null;
  }

  const refreshSecret = newOpaqueToken();
  const nextCsrfToken = newOpaqueToken();
  const updated = await prisma.authSession.updateMany({
    where: { id: session.id, refresh_token_hash: refreshHash, revokedAt: null, expiresAt: { gt: now } },
    data: {
      refresh_token_hash: hashToken(buildRefreshToken(session.id, refreshSecret)),
      csrf_token_hash: hashToken(nextCsrfToken),
      lastUsedAt: now,
    },
  });

  if (updated.count !== 1) return null;

  return {
    accessToken: issueAccessToken(session.user, session.id),
    refreshToken: buildRefreshToken(session.id, refreshSecret),
    csrfToken: nextCsrfToken,
    user: session.user,
    expiresAt: session.expiresAt,
  };
};

const revokeSessionFromToken = async (refreshToken, csrfToken) => {
  const parsed = parseRefreshToken(refreshToken);
  if (!parsed || !csrfToken) return false;
  const revoked = await prisma.authSession.updateMany({
    where: {
      id: parsed.sessionId,
      refresh_token_hash: hashToken(refreshToken),
      csrf_token_hash: hashToken(csrfToken),
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
  return revoked.count === 1;
};

const revokeAllUserSessions = (userId) => prisma.authSession.updateMany({
  where: { user_id: userId, revokedAt: null },
  data: { revokedAt: new Date() },
});

const getActiveSessionUser = async (sessionId) => prisma.authSession.findFirst({
  where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() }, user: { status: 1 } },
  include: { user: true },
});

module.exports = {
  ACCESS_TOKEN_TTL,
  SESSION_TTL_MS,
  getConfig,
  issueAccessToken,
  createSession,
  refreshSession,
  revokeSessionFromToken,
  revokeAllUserSessions,
  getActiveSessionUser,
};
