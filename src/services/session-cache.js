const ttlMs = Math.max(Number.parseInt(process.env.SESSION_CACHE_TTL_MS || "30000", 10), 0);
const entries = new Map();

const get = (sessionId, now = Date.now()) => {
  const entry = entries.get(sessionId);
  if (!entry) return null;
  if (entry.cachedUntil <= now || entry.session.expiresAt.getTime() <= now) {
    entries.delete(sessionId);
    return null;
  }
  return entry.session;
};

const set = (sessionId, session, now = Date.now()) => {
  if (ttlMs <= 0) return;
  entries.set(sessionId, {
    session,
    cachedUntil: Math.min(now + ttlMs, session.expiresAt.getTime()),
  });
};

const invalidate = (sessionId) => entries.delete(sessionId);
const invalidateUser = (userId) => {
  for (const [sessionId, entry] of entries) {
    if (entry.session.user_id === userId) entries.delete(sessionId);
  }
};

module.exports = { get, set, invalidate, invalidateUser };
