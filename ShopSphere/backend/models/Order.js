const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required"],
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Seller reference is required"],
    },
    title: {
      type: String,
      required: [true, "Product title snapshot is required"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Product price snapshot is required"],
      min: [0, "Price cannot be negative"],
    },
    thumbnail: {
      type: String,
      default: "",
      trim: true,
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Customer is required"],
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: "Order must contain at least one item",
      },
    },
    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
      min: [0, "Total amount cannot be negative"],
    },
    shippingAddress: {
      name: {
        type: String,
        required: [true, "Recipient name is required"],
        trim: true,
      },
      email: {
        type: String,
        required: [true, "Recipient email is required"],
        lowercase: true,
        trim: true,
      },
      address: {
        type: String,
        required: [true, "Shipping address is required"],
        trim: true,
      },
    },
    paymentMethod: {
      type: String,
      enum: ["card", "upi", "cash"],
      required: [true, "Payment method is required"],
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
      default: "pending",
      required: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for customer order history and seller order queries sorted newest-first
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ "items.seller": 1, createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
