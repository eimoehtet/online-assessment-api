const jwt = require("jsonwebtoken");
const { getConfig, getActiveSessionUser } = require("../services/auth.service");

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  let config;
  try {
    config = getConfig();
  } catch (_error) {
    return res.status(500).json({ message: "JWT secret is not configured." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, config.accessSecret, {
      issuer: config.issuer,
      audience: config.audience,
    });
    if (!payload.sid) {
      return res.status(401).json({ message: "Invalid or expired token." });
    }

    const activeSession = await getActiveSessionUser(payload.sid);
    if (!activeSession || activeSession.user.id !== payload.id) {
      return res.status(401).json({ message: "Invalid or expired token." });
    }

    req.user = {
      id: activeSession.user.id,
      email: activeSession.user.email,
      role: activeSession.user.role,
      sid: activeSession.id,
    };
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

module.exports = authMiddleware;
