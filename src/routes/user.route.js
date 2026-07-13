const { Router } = require("express");
const {
  login,
  createUserByAdmin,
  getUsersByAdmin,
  getUserByIdByAdmin,
  updateUserByAdmin,
  deleteUserByAdmin,
} = require("../controllers/user.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRole = require("../middlewares/authorize-role.middleware");

const router = Router();

router.post("/login", login);

router.use(authMiddleware);
router.use(authorizeRole("ADMIN"));

router.post("/", createUserByAdmin);
router.get("/", getUsersByAdmin);
router.get("/:id", getUserByIdByAdmin);
router.patch("/:id", updateUserByAdmin);
router.delete("/:id", deleteUserByAdmin);

module.exports = router;
