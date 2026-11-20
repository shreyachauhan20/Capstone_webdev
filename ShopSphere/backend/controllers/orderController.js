const mongoose = require("mongoose");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const InventoryLog = require("../models/InventoryLog");
const appEvents = require("../events/appEvents");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_PAYMENT_METHODS = ["card", "upi", "cash"];

// Custom error class so validation/stock errors return proper HTTP status codes
class OrderError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Check if error is caused by MongoDB standalone server not supporting transactions
const isTransactionUnsupportedError = (error) => {
  if (!error) return false;
  const msg = error.message || "";
  return (
    error.code === 20 ||
    error.codeName === "IllegalOperation" ||
    msg.includes("Transaction numbers are only allowed on a replica set") ||
    msg.includes("transactions are not supported")
  );
};

// Format an order safely for a seller (only their own items, no unrelated customer PII)
const formatOrderForSeller = (order, sellerId) => {
  const sellerItems = order.items.filter(
    (item) => item.seller.toString() === sellerId.toString()
  );

  const sellerSubtotal = sellerItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return {
    _id: order._id,
    items: sellerItems,
    sellerSubtotal: Number(sellerSubtotal.toFixed(2)),
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
};

// Validate delivery info and payment method from request body
const parseAndValidateCheckoutInput = (body) => {
  const source = body.shippingAddress || body;
  const name = typeof source.name === "string" ? source.name.trim() : "";
  const email =
    typeof source.email === "string" ? source.email.trim().toLowerCase() : "";
  const address =
    typeof source.address === "string" ? source.address.trim() : "";

  if (!name || !email || !address) {
    throw new OrderError(
      "Delivery name, email, and shipping address are required",
      400
    );
  }

  if (!EMAIL_REGEX.test(email)) {
    throw new OrderError("Please provide a valid delivery email address", 400);
  }

  const paymentMethod =
    typeof body.paymentMethod === "string"
      ? body.paymentMethod.trim().toLowerCase()
      : "";

  if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
    throw new OrderError(
      "Invalid payment method. Allowed methods: card, upi, cash",
      400
    );
  }

  return {
    shippingAddress: { name, email, address },
    paymentMethod,
  };
};

// Primary checkout flow using a MongoDB transaction (requires replica set)
const checkoutWithTransaction = async (
  userId,
  shippingAddress,
  paymentMethod
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const cart = await Cart.findOne({ user: userId }).session(session);
    if (!cart || !cart.items || cart.items.length === 0) {
      throw new OrderError("Cannot place order with an empty cart", 400);
    }

    const orderItems = [];
    const logPayloads = [];
    const lowStockProducts = [];
    let totalAmount = 0;

    for (const cartItem of cart.items) {
      const product = await Product.findById(cartItem.product).session(session);

      if (!product) {
        throw new OrderError(
          "One or more products in your cart no longer exist",
          404
        );
      }

      if (!product.isActive) {
        throw new OrderError(
          `Product '${product.title}' is currently inactive`,
          400
        );
      }

      // Atomic stock check & deduction inside the transaction
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: product._id,
          isActive: true,
          stock: { $gte: cartItem.quantity },
        },
        { $inc: { stock: -cartItem.quantity } },
        { new: true, session }
      );

      if (!updatedProduct) {
        throw new OrderError(
          `Insufficient stock for '${product.title}'. Available: ${product.stock}`,
          400
        );
      }

      // Snapshot title, price, thumbnail, seller, and quantity using DB values
      const lineTotal = updatedProduct.price * cartItem.quantity;
      totalAmount += lineTotal;

      orderItems.push({
        product: updatedProduct._id,
        seller: updatedProduct.seller,
        title: updatedProduct.title,
        price: updatedProduct.price,
        thumbnail: updatedProduct.thumbnail || "",
        quantity: cartItem.quantity,
      });

      logPayloads.push({
        product: updatedProduct._id,
        changedBy: userId,
        changeType: "order_placed",
        quantityChanged: -cartItem.quantity,
        previousStock: updatedProduct.stock + cartItem.quantity,
        newStock: updatedProduct.stock,
        note: "Stock deducted on order checkout",
      });

      if (updatedProduct.stock <= updatedProduct.lowStockThreshold) {
        lowStockProducts.push(updatedProduct);
      }
    }

    // Simulate payment success only after all validations and stock deductions succeed
    const simulatedPaymentStatus =
      paymentMethod === "cash" ? "pending" : "paid";

    const [createdOrder] = await Order.create(
      [
        {
          user: userId,
          items: orderItems,
          totalAmount: Number(totalAmount.toFixed(2)),
          shippingAddress,
          paymentMethod,
          paymentStatus: simulatedPaymentStatus,
          status: "confirmed",
        },
      ],
      { session }
    );

    // Record InventoryLogs linked to the created order
    const logsWithOrderId = logPayloads.map((log) => ({
      ...log,
      order: createdOrder._id,
    }));
    await InventoryLog.insertMany(logsWithOrderId, { session });

    // Clear the customer's cart only after successful order creation
    cart.items = [];
    await cart.save({ session });

    await session.commitTransaction();

    return { order: createdOrder, usedTransaction: true, lowStockProducts };
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction().catch(() => {});
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

// Fallback checkout flow for standalone local MongoDB (no replica set)
// Uses atomic per-item stock deduction and restores deducted stock if any step fails.
const checkoutWithRollback = async (
  userId,
  shippingAddress,
  paymentMethod
) => {
  const cart = await Cart.findOne({ user: userId });
  if (!cart || !cart.items || cart.items.length === 0) {
    throw new OrderError("Cannot place order with an empty cart", 400);
  }

  // Step 1: Pre-validate all products before deducting any inventory
  for (const cartItem of cart.items) {
    const product = await Product.findById(cartItem.product);
    if (!product) {
      throw new OrderError(
        "One or more products in your cart no longer exist",
        404
      );
    }
    if (!product.isActive) {
      throw new OrderError(
        `Product '${product.title}' is currently inactive`,
        400
      );
    }
    if (product.stock < cartItem.quantity) {
      throw new OrderError(
        `Insufficient stock for '${product.title}'. Available: ${product.stock}`,
        400
      );
    }
  }

  // Step 2: Atomically deduct each item's stock and track for rollback on failure
  const deductedItems = [];
  const orderItems = [];
  const logPayloads = [];
  const lowStockProducts = [];
  let totalAmount = 0;
  let createdOrder = null;

  try {
    for (const cartItem of cart.items) {
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: cartItem.product,
          isActive: true,
          stock: { $gte: cartItem.quantity },
        },
        { $inc: { stock: -cartItem.quantity } },
        { new: true }
      );

      if (!updatedProduct) {
        const latestProduct = await Product.findById(cartItem.product);
        const label = latestProduct ? latestProduct.title : cartItem.product;
        const avail = latestProduct ? latestProduct.stock : 0;
        throw new OrderError(
          `Insufficient stock or inactive product '${label}'. Available: ${avail}`,
          400
        );
      }

      deductedItems.push({
        productId: updatedProduct._id,
        quantity: cartItem.quantity,
      });

      totalAmount += updatedProduct.price * cartItem.quantity;

      orderItems.push({
        product: updatedProduct._id,
        seller: updatedProduct.seller,
        title: updatedProduct.title,
        price: updatedProduct.price,
        thumbnail: updatedProduct.thumbnail || "",
        quantity: cartItem.quantity,
      });

      logPayloads.push({
        product: updatedProduct._id,
        changedBy: userId,
        changeType: "order_placed",
        quantityChanged: -cartItem.quantity,
        previousStock: updatedProduct.stock + cartItem.quantity,
        newStock: updatedProduct.stock,
        note: "Stock deducted on order checkout",
      });

      if (updatedProduct.stock <= updatedProduct.lowStockThreshold) {
        lowStockProducts.push(updatedProduct);
      }
    }

    // Step 3: Simulate payment success after stock is reserved
    const simulatedPaymentStatus =
      paymentMethod === "cash" ? "pending" : "paid";

    createdOrder = await Order.create({
      user: userId,
      items: orderItems,
      totalAmount: Number(totalAmount.toFixed(2)),
      shippingAddress,
      paymentMethod,
      paymentStatus: simulatedPaymentStatus,
      status: "confirmed",
    });

    // Step 4: Record InventoryLogs and clear cart
    const logsWithOrderId = logPayloads.map((log) => ({
      ...log,
      order: createdOrder._id,
    }));
    await InventoryLog.insertMany(logsWithOrderId);

    cart.items = [];
    await cart.save();

    return { order: createdOrder, usedTransaction: false, lowStockProducts };
  } catch (error) {
    // Compensating rollback: restore any stock already deducted
    for (const item of deductedItems) {
      try {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: item.quantity },
        });
      } catch (rollbackErr) {
        console.error(
          `CRITICAL: Failed to rollback stock for product ${item.productId}:`,
          rollbackErr.message
        );
      }
    }

    // Remove partially created order if clearing cart or logging failed
    if (createdOrder && createdOrder._id) {
      try {
        await Order.findByIdAndDelete(createdOrder._id);
        await InventoryLog.deleteMany({ order: createdOrder._id });
      } catch (cleanupErr) {
        console.error(
          `CRITICAL: Failed to remove incomplete order ${createdOrder._id}:`,
          cleanupErr.message
        );
      }
    }

    throw error;
  }
};

// @desc    Place a new order from the customer's cart
// @route   POST /api/orders
// @access  Customer only
const placeOrder = async (req, res) => {
  try {
    const { shippingAddress, paymentMethod } = parseAndValidateCheckoutInput(
      req.body
    );

    let result;
    try {
      result = await checkoutWithTransaction(
        req.user._id,
        shippingAddress,
        paymentMethod
      );
    } catch (error) {
      if (isTransactionUnsupportedError(error)) {
        // Standalone local MongoDB fallback with compensating rollback
        result = await checkoutWithRollback(
          req.user._id,
          shippingAddress,
          paymentMethod
        );
      } else {
        throw error;
      }
    }

    await result.order.populate(
      "items.product",
      "title price thumbnail isActive"
    );

    // Emit order-placed event (creates notifications and triggers low-stock alerts)
    appEvents.emit("order-placed", {
      order: result.order,
      lowStockProducts: result.lowStockProducts || [],
    });

    return res.status(201).json({
      message: "Order placed successfully",
      checkoutMode: result.usedTransaction
        ? "mongodb_transaction"
        : "atomic_item_deduction_with_rollback",
      order: result.order,
    });
  } catch (error) {
    if (error instanceof OrderError) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    console.error("Place order error:", error.message);
    return res.status(500).json({
      message: "Server error while placing order",
    });
  }
};

// @desc    Get orders scoped to the authenticated user's role
// @route   GET /api/orders
// @access  Customer (own), Seller (orders containing their items), Admin (all)
const getOrders = async (req, res) => {
  try {
    if (req.user.role === "customer") {
      const orders = await Order.find({ user: req.user._id })
        .populate("items.product", "title price thumbnail isActive")
        .sort({ createdAt: -1 });

      return res.status(200).json({
        count: orders.length,
        orders,
      });
    }

    if (req.user.role === "seller") {
      const orders = await Order.find({ "items.seller": req.user._id })
        .select("-shippingAddress -user")
        .populate("items.product", "title price thumbnail isActive")
        .sort({ createdAt: -1 });

      const sellerOrders = orders.map((order) =>
        formatOrderForSeller(order, req.user._id)
      );

      return res.status(200).json({
        count: sellerOrders.length,
        orders: sellerOrders,
      });
    }

    // Admin sees all orders
    const orders = await Order.find()
      .populate("user", "name email role")
      .populate("items.product", "title price thumbnail isActive")
      .populate("items.seller", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error("Get orders error:", error.message);
    return res.status(500).json({
      message: "Server error while fetching orders",
    });
  }
};

// @desc    Get seller's orders (only items owned by the seller, no customer PII)
// @route   GET /api/orders/seller
// @access  Seller only
const getSellerOrders = async (req, res) => {
  try {
    const orders = await Order.find({ "items.seller": req.user._id })
      .select("-shippingAddress -user")
      .populate("items.product", "title price thumbnail isActive")
      .sort({ createdAt: -1 });

    const sellerOrders = orders.map((order) =>
      formatOrderForSeller(order, req.user._id)
    );

    return res.status(200).json({
      count: sellerOrders.length,
      orders: sellerOrders,
    });
  } catch (error) {
    console.error("Get seller orders error:", error.message);
    return res.status(500).json({
      message: "Server error while fetching seller orders",
    });
  }
};

// @desc    Get all orders (Admin only)
// @route   GET /api/orders/admin
// @access  Admin only
const getAllOrdersAdmin = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user", "name email role")
      .populate("items.product", "title price thumbnail isActive")
      .populate("items.seller", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error("Get admin orders error:", error.message);
    return res.status(500).json({
      message: "Server error while fetching all orders",
    });
  }
};

// @desc    Get single order by ID (access checked by role & ownership)
// @route   GET /api/orders/:id
// @access  Owner Customer, Involved Seller, or Admin
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid order ID",
      });
    }

    const order = await Order.findById(id).populate(
      "items.product",
      "title price thumbnail isActive"
    );

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (req.user.role === "customer") {
      if (order.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Forbidden: you can only view your own orders",
        });
      }
      return res.status(200).json({ order });
    }

    if (req.user.role === "seller") {
      const hasSellerItem = order.items.some(
        (item) => item.seller.toString() === req.user._id.toString()
      );
      if (!hasSellerItem) {
        return res.status(403).json({
          message: "Forbidden: this order does not contain your products",
        });
      }
      return res.status(200).json({
        order: formatOrderForSeller(order, req.user._id),
      });
    }

    // Admin
    await order.populate("user", "name email role");
    await order.populate("items.seller", "name email");

    return res.status(200).json({ order });
  } catch (error) {
    console.error("Get order by ID error:", error.message);
    return res.status(500).json({
      message: "Server error while fetching order",
    });
  }
};

// @desc    Cancel an eligible order (pending or confirmed) and restore stock
// @route   PATCH /api/orders/:id/cancel  (or PUT)
// @access  Owner Customer or Admin
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid order ID",
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    // Only the customer who placed the order or an admin can cancel it
    if (
      req.user.role !== "admin" &&
      order.user.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "Forbidden: you can only cancel your own orders",
      });
    }

    // Only pending or confirmed orders can be cancelled
    if (!["pending", "confirmed"].includes(order.status)) {
      return res.status(400).json({
        message: `Cannot cancel order with current status '${order.status}'`,
      });
    }

    // Restore stock for each item and write InventoryLog entries
    for (const item of order.items) {
      const updatedProduct = await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } },
        { new: true }
      );

      if (updatedProduct) {
        await InventoryLog.create({
          product: updatedProduct._id,
          changedBy: req.user._id,
          order: order._id,
          changeType: "order_cancelled",
          quantityChanged: item.quantity,
          previousStock: updatedProduct.stock - item.quantity,
          newStock: updatedProduct.stock,
          note: "Stock restored on order cancellation",
        });
      }
    }

    order.status = "cancelled";
    order.cancelledAt = new Date();
    if (order.paymentStatus === "paid") {
      order.paymentStatus = "refunded";
    }
    await order.save();

    appEvents.emit("order-cancelled", { order });

    return res.status(200).json({
      message: "Order cancelled and stock restored",
      order,
    });
  } catch (error) {
    console.error("Cancel order error:", error.message);
    return res.status(500).json({
      message: "Server error while cancelling order",
    });
  }
};

// @desc    Update order status (Seller for their orders or Admin)
// @route   PATCH /api/orders/:id/status  (or PUT)
// @access  Involved Seller or Admin (customers forbidden)
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid order ID",
      });
    }

    const allowedNextStatuses = ["confirmed", "shipped", "delivered"];
    if (!status || !allowedNextStatuses.includes(status)) {
      return res.status(400).json({
        message:
          "Invalid status. Allowed values: confirmed, shipped, delivered",
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (req.user.role === "seller") {
      const hasSellerItem = order.items.some(
        (item) => item.seller.toString() === req.user._id.toString()
      );
      if (!hasSellerItem) {
        return res.status(403).json({
          message: "Forbidden: this order does not contain your products",
        });
      }
    }

    if (order.status === "cancelled" || order.status === "delivered") {
      return res.status(400).json({
        message: `Cannot change status of an order that is already '${order.status}'`,
      });
    }

    order.status = status;
    await order.save();

    appEvents.emit("order-status-updated", { order });

    return res.status(200).json({
      message: "Order status updated successfully",
      order:
        req.user.role === "seller"
          ? formatOrderForSeller(order, req.user._id)
          : order,
    });
  } catch (error) {
    console.error("Update order status error:", error.message);
    return res.status(500).json({
      message: "Server error while updating order status",
    });
  }
};

module.exports = {
  placeOrder,
  getOrders,
  getSellerOrders,
  getAllOrdersAdmin,
  getOrderById,
  cancelOrder,
  updateOrderStatus,
};
