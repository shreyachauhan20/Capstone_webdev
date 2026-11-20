const express = require("express");
const {
  getSalesReport,
  getBestSellingProducts,
  getInventorySummary,
} = require("../controllers/analyticsController");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

// Analytics endpoints are restricted to sellers and admins
router.use(protect, authorizeRoles("seller", "admin"));

router.get("/sales", getSalesReport);
router.get("/best-sellers", getBestSellingProducts);
router.get("/inventory-summary", getInventorySummary);

module.exports = router;
