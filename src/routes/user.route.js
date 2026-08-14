const { Router } = require("express");
const {
  login,
  refresh,
  logout,
  getCurrentUser,
  createUserByAdmin,
  getUsersByAdmin,
  getUserByIdByAdmin,
  updateUserByAdmin,
  deleteUserByAdmin,
  resetUserPasswordByAdmin,
  changePasswordByUser,
  getTeachersByAdmin,
  getStudentsByAdmin,
  toggleUserStatusByAdmin,
  forgotPasswordController,
  resetPasswordWithTokenController,
} = require("../controllers/user.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRole = require("../middlewares/authorize-role.middleware");

const router = Router();

router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/forgot-password", forgotPasswordController);
router.post("/reset-password-with-token", resetPasswordWithTokenController);

router.use(authMiddleware);
router.get("/me", getCurrentUser);
router.post("/me/change-password", changePasswordByUser);

router.use(authorizeRole("ADMIN"));

router.post("/", createUserByAdmin);
router.get("/", getUsersByAdmin);
router.get("/students", getStudentsByAdmin);
router.get("/teachers", getTeachersByAdmin);
router.get("/:id", getUserByIdByAdmin);
router.patch("/:id", updateUserByAdmin);
router.delete("/:id", deleteUserByAdmin);
router.post("/:id/reset-password", resetUserPasswordByAdmin);
router.post("/:id/toggle-status", authorizeRole("ADMIN"), toggleUserStatusByAdmin);

module.exports = router;
