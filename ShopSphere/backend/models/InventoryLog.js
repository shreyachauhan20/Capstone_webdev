const mongoose = require("mongoose");

const inventoryLogSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    changeType: {
      type: String,
      enum: ["restock", "order_placed", "order_cancelled", "manual_adjustment"],
      required: [true, "Change type is required"],
    },
    quantityChanged: {
      type: Number,
      required: [true, "Quantity changed is required"],
    },
    previousStock: {
      type: Number,
      required: [true, "Previous stock is required"],
      min: [0, "Previous stock cannot be negative"],
    },
    newStock: {
      type: Number,
      required: [true, "New stock is required"],
      min: [0, "New stock cannot be negative"],
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for viewing stock change history of a product newest-first
inventoryLogSchema.index({ product: 1, createdAt: -1 });

module.exports = mongoose.model("InventoryLog", inventoryLogSchema);
