const { Router } = require("express");
const { updateAttendanceController, getQuizAttendanceController } = require("../controllers/quiz_attendance.controller");
const authMiddleware = require('../middlewares/auth.middleware');
const authorizeRole = require('../middlewares/authorize-role.middleware');

const router = Router();

router.use(authMiddleware);
router.use(authorizeRole('ADMIN', 'TEACHER'));

router.get("/:quiz_id", getQuizAttendanceController);
router.patch("/:quiz_id", updateAttendanceController);

module.exports = router;