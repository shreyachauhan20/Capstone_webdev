const express = require("express");
const {
  getInventoryOverview,
  getLowStockProducts,
  updateProductStock,
  getInventoryLogs,
} = require("../controllers/inventoryController");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

// Inventory management is restricted to sellers and admins
router.use(protect, authorizeRoles("seller", "admin"));

router.get("/", getInventoryOverview);
router.get("/low-stock", getLowStockProducts);
router.get("/logs", getInventoryLogs);
router.get("/logs/:productId", getInventoryLogs);
router.put("/:productId", updateProductStock);
router.patch("/:productId", updateProductStock);

module.exports = router;
