const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    console.log("User role:", req.user?.role);
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };
};

module.exports = authorizeRole;
