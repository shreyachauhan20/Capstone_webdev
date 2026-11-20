const express = require("express");
const {
  placeOrder,
  getOrders,
  getSellerOrders,
  getAllOrdersAdmin,
  getOrderById,
  cancelOrder,
  updateOrderStatus,
} = require("../controllers/orderController");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

// All order endpoints require authentication
router.use(protect);

// Customer checkout
router.post("/", authorizeRoles("customer"), placeOrder);

// Role-specific order listing routes (defined before /:id)
router.get("/seller", authorizeRoles("seller"), getSellerOrders);
router.get("/admin", authorizeRoles("admin"), getAllOrdersAdmin);

// Role-scoped general order listing & single order lookup
router.get("/", authorizeRoles("customer", "seller", "admin"), getOrders);
router.get("/:id", authorizeRoles("customer", "seller", "admin"), getOrderById);

// Order cancellation (owner customer or admin)
router.patch("/:id/cancel", authorizeRoles("customer", "admin"), cancelOrder);
router.put("/:id/cancel", authorizeRoles("customer", "admin"), cancelOrder);

// Order status updates (seller or admin only; customers forbidden)
router.patch("/:id/status", authorizeRoles("seller", "admin"), updateOrderStatus);
router.put("/:id/status", authorizeRoles("seller", "admin"), updateOrderStatus);

module.exports = router;
