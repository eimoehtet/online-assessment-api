const { Router } = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRole = require("../middlewares/authorize-role.middleware");
const { getStats } = require("../controllers/dashboard.controller");

const router = Router();
router.get("/stats", authMiddleware, authorizeRole("ADMIN", "TEACHER", "STUDENT"), getStats);

module.exports = router;
