const express = require("express");
const {
  register,
  login,
  refreshAccessToken,
  logout,
  getMe,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

// Public authentication routes
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logout);

// Protected route to fetch current authenticated user
router.get(
  "/me",
  protect,
  authorizeRoles("customer", "seller", "admin"),
  getMe
);

module.exports = router;
