const EventEmitter = require("events");
const Notification = require("../models/Notification");
const { emitToUser } = require("../config/socket");

class ShopSphereEventEmitter extends EventEmitter { }

const appEvents = new ShopSphereEventEmitter();

// Helper to persist a notification in MongoDB and push it in real time via Socket.IO
const createAndSendNotification = async ({
  user,
  title,
  message,
  type = "general",
  relatedOrder = null,
  relatedProduct = null,
  socketEvent = "notification",
}) => {
  try {
    const notification = await Notification.create({
      user,
      title,
      message,
      type,
      relatedOrder,
      relatedProduct,
    });

    emitToUser(user, "notification", notification);
    if (socketEvent && socketEvent !== "notification") {
      emitToUser(user, socketEvent, notification);
    }
  } catch (error) {
    console.error("Notification event error:", error.message);
  }
};

// Event 1: Order Placed
appEvents.on("order-placed", async ({ order, lowStockProducts = [] }) => {
  try {
    console.log(`[Event: order-placed] Order ${order._id} placed`);

    // 1. Notify the customer who placed the order
    await createAndSendNotification({
      user: order.user,
      title: "Order Confirmed",
      message: `Your order #${order._id.toString().slice(-6)} for ₹${order.totalAmount} has been placed (${order.status}).`,
      type: "order",
      relatedOrder: order._id,
      socketEvent: "order:statusUpdated",
    });

    // 2. Notify each seller whose items are in the order (without customer PII)
    const sellerItemsCount = new Map();
    for (const item of order.items) {
      const sellerId = item.seller.toString();
      sellerItemsCount.set(
        sellerId,
        (sellerItemsCount.get(sellerId) || 0) + item.quantity
      );
    }

    for (const [sellerId, totalUnits] of sellerItemsCount.entries()) {
      await createAndSendNotification({
        user: sellerId,
        title: "New Order Received",
        message: `Order #${order._id.toString().slice(-6)} includes ${totalUnits} unit(s) from your catalog.`,
        type: "order",
        relatedOrder: order._id,
      });
    }

    // 3. Trigger low-stock events for any products that crossed their threshold
    for (const product of lowStockProducts) {
      appEvents.emit("stock-low", { product });
    }
  } catch (error) {
    console.error("[Event: order-placed] Handler error:", error.message);
  }
});

// Event 2: Stock Low
appEvents.on("stock-low", async ({ product }) => {
  try {
    if (!product) return;

    console.warn(
      `[Event: stock-low] Product "${product.title}" stock=${product.stock} (threshold=${product.lowStockThreshold})`
    );

    await createAndSendNotification({
      user: product.seller,
      title: "Low Stock Alert",
      message: `"${product.title}" is running low on stock (${product.stock} left, threshold: ${product.lowStockThreshold}).`,
      type: "low_stock",
      relatedProduct: product._id,
      socketEvent: "stock:low",
    });
  } catch (error) {
    console.error("[Event: stock-low] Handler error:", error.message);
  }
});

// Event 3: Order Cancelled
appEvents.on("order-cancelled", async ({ order }) => {
  try {
    console.log(`[Event: order-cancelled] Order ${order._id} cancelled`);

    await createAndSendNotification({
      user: order.user,
      title: "Order Cancelled",
      message: `Your order #${order._id.toString().slice(-6)} has been cancelled and stock has been restored.`,
      type: "order",
      relatedOrder: order._id,
      socketEvent: "order:statusUpdated",
    });

    // Notify involved sellers without customer PII
    const sellerIds = [
      ...new Set(order.items.map((item) => item.seller.toString())),
    ];
    for (const sellerId of sellerIds) {
      await createAndSendNotification({
        user: sellerId,
        title: "Order Item Cancelled",
        message: `Order #${order._id.toString().slice(-6)} was cancelled; item stock has been restored.`,
        type: "order",
        relatedOrder: order._id,
      });
    }
  } catch (error) {
    console.error("[Event: order-cancelled] Handler error:", error.message);
  }
});

// Event 4: Order Status Updated (by Seller or Admin)
appEvents.on("order-status-updated", async ({ order }) => {
  try {
    console.log(
      `[Event: order-status-updated] Order ${order._id} -> ${order.status}`
    );

    await createAndSendNotification({
      user: order.user,
      title: "Order Status Updated",
      message: `Your order #${order._id.toString().slice(-6)} status is now "${order.status}".`,
      type: "order",
      relatedOrder: order._id,
      socketEvent: "order:statusUpdated",
    });
  } catch (error) {
    console.error("[Event: order-status-updated] Handler error:", error.message);
  }
});

module.exports = appEvents;
