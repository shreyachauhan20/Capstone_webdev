const mongoose = require("mongoose");
const Product = require("../models/Product");
const InventoryLog = require("../models/InventoryLog");
const appEvents = require("../events/appEvents");

// @desc    Get inventory overview for seller (own products) or admin (all products)
// @route   GET /api/inventory
// @access  Seller or Admin
const getInventoryOverview = async (req, res) => {
  try {
    const filter = req.user.role === "seller" ? { seller: req.user._id } : {};

    const products = await Product.find(filter)
      .populate("category", "name slug")
      .populate("seller", "name")
      .sort({ stock: 1, updatedAt: -1 });

    const lowStockProducts = products.filter(
      (p) => p.stock <= p.lowStockThreshold
    );

    const outOfStockCount = products.filter((p) => p.stock === 0).length;

    return res.status(200).json({
      totalProducts: products.length,
      lowStockCount: lowStockProducts.length,
      outOfStockCount,
      lowStockProducts,
      products,
    });
  } catch (error) {
    console.error("Get inventory overview error:", error.message);
    return res.status(500).json({
      message: "Server error while fetching inventory overview",
    });
  }
};

// @desc    Get low-stock products (stock <= lowStockThreshold)
// @route   GET /api/inventory/low-stock
// @access  Seller or Admin
const getLowStockProducts = async (req, res) => {
  try {
    const filter = {
      $expr: { $lte: ["$stock", "$lowStockThreshold"] },
    };

    if (req.user.role === "seller") {
      filter.seller = req.user._id;
    }

    const products = await Product.find(filter)
      .populate("category", "name slug")
      .populate("seller", "name")
      .sort({ stock: 1 });

    return res.status(200).json({
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Get low stock products error:", error.message);
    return res.status(500).json({
      message: "Server error while fetching low-stock products",
    });
  }
};

// @desc    Update or adjust stock for a product and log the change
// @route   PUT /api/inventory/:productId  (or PATCH)
// @access  Owner Seller or Admin
const updateProductStock = async (req, res) => {
  try {
    const { productId } = req.params;
    const { stock, adjustment, note } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        message: "Invalid product ID",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    // Ownership check: sellers can only manage inventory for their own products
    if (
      req.user.role !== "admin" &&
      product.seller.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        message:
          "Forbidden: you can only manage inventory for your own products",
      });
    }

    const previousStock = product.stock;
    let newStock;
    let quantityChanged;

    if (stock !== undefined) {
      if (stock === null || stock === "" || typeof stock === "boolean") {
        return res.status(400).json({
          message: "Stock must be a valid non-negative whole number",
        });
      }
      const parsedStock = Number(stock);
      if (!Number.isInteger(parsedStock) || parsedStock < 0) {
        return res.status(400).json({
          message: "Stock must be a valid non-negative whole number",
        });
      }
      newStock = parsedStock;
      quantityChanged = newStock - previousStock;
    } else if (adjustment !== undefined) {
      if (
        adjustment === null ||
        adjustment === "" ||
        typeof adjustment === "boolean"
      ) {
        return res.status(400).json({
          message: "Adjustment must be a valid non-zero whole number",
        });
      }
      const parsedAdj = Number(adjustment);
      if (!Number.isInteger(parsedAdj) || parsedAdj === 0) {
        return res.status(400).json({
          message: "Adjustment must be a non-zero whole number",
        });
      }
      newStock = previousStock + parsedAdj;
      if (newStock < 0) {
        return res.status(400).json({
          message: `Stock cannot become negative. Current stock: ${previousStock}`,
        });
      }
      quantityChanged = parsedAdj;
    } else {
      return res.status(400).json({
        message: "Provide either 'stock' or 'adjustment' in the request body",
      });
    }

    if (quantityChanged === 0) {
      return res.status(200).json({
        message: "Stock unchanged",
        product,
      });
    }

    // Atomic conditional update ensures stock never becomes negative under concurrency
    const updatedProduct = await Product.findOneAndUpdate(
      {
        _id: product._id,
        ...(quantityChanged < 0
          ? { stock: { $gte: Math.abs(quantityChanged) } }
          : {}),
      },
      { $set: { stock: newStock } },
      { new: true }
    )
      .populate("category", "name slug")
      .populate("seller", "name");

    if (!updatedProduct) {
      return res.status(400).json({
        message: "Unable to update stock without going negative",
      });
    }

    const changeType =
      quantityChanged > 0 ? "restock" : "manual_adjustment";

    const log = await InventoryLog.create({
      product: updatedProduct._id,
      changedBy: req.user._id,
      changeType,
      quantityChanged,
      previousStock,
      newStock: updatedProduct.stock,
      note:
        typeof note === "string" && note.trim()
          ? note.trim()
          : quantityChanged > 0
            ? "Manual stock restock"
            : "Manual stock reduction",
    });

    // Emit low-stock event if updated stock is at or below threshold
    if (updatedProduct.stock <= updatedProduct.lowStockThreshold) {
      appEvents.emit("stock-low", { product: updatedProduct });
    }

    return res.status(200).json({
      message: "Inventory updated successfully",
      product: updatedProduct,
      log,
    });
  } catch (error) {
    console.error("Update inventory error:", error.message);
    return res.status(500).json({
      message: "Server error while updating inventory",
    });
  }
};

// @desc    Get inventory logs (all or filtered by productId, scoped to seller ownership)
// @route   GET /api/inventory/logs  and  GET /api/inventory/logs/:productId
// @access  Seller or Admin
const getInventoryLogs = async (req, res) => {
  try {
    const productId = req.params.productId || req.query.productId;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));

    const filter = {};

    if (productId) {
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({
          message: "Invalid product ID",
        });
      }

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          message: "Product not found",
        });
      }

      if (
        req.user.role !== "admin" &&
        product.seller.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          message: "Forbidden: you can only view logs for your own products",
        });
      }

      filter.product = product._id;
    } else if (req.user.role === "seller") {
      const sellerProducts = await Product.find({ seller: req.user._id }).select(
        "_id"
      );
      const sellerProductIds = sellerProducts.map((p) => p._id);
      filter.product = { $in: sellerProductIds };
    }

    const logs = await InventoryLog.find(filter)
      .populate("product", "title stock lowStockThreshold")
      .populate("changedBy", "name role")
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.status(200).json({
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error("Get inventory logs error:", error.message);
    return res.status(500).json({
      message: "Server error while fetching inventory logs",
    });
  }
};

module.exports = {
  getInventoryOverview,
  getLowStockProducts,
  updateProductStock,
  getInventoryLogs,
};
