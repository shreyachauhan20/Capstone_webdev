const express = require("express");
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

// Public routes
router.get("/", getAllProducts);
router.get("/:id", getProductById);

// Protected Seller / Admin routes (ownership enforced in controller)
router.post("/", protect, authorizeRoles("seller", "admin"), createProduct);
router.put("/:id", protect, authorizeRoles("seller", "admin"), updateProduct);
router.delete(
  "/:id",
  protect,
  authorizeRoles("seller", "admin"),
  deleteProduct
);

module.exports = router;
