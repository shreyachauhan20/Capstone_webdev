import { useContext, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { CartContext } from "../context/CartContext";
import {
  cancelOrderApi,
  getOrdersApi,
  updateOrderStatusApi,
} from "../utils/api";

function Orders() {
  const { user, refreshNotifications } = useContext(AuthContext);
  const { notifyInventoryChanged } = useContext(CartContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  const loadOrders = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await getOrdersApi();
      setOrders(data.orders || []);
    } catch (err) {
      setError(err.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) loadOrders();
    });
    return () => {
      active = false;
    };
  }, [loadOrders]);

  const handleCancelOrder = async (orderId) => {
    setError("");
    setActionMsg("");
    try {
      await cancelOrderApi(orderId);
      setActionMsg("Order cancelled and stock restored.");
      notifyInventoryChanged();
      await loadOrders();
      await refreshNotifications();
    } catch (err) {
      setError(err.message || "Could not cancel order");
    }
  };

  const handleStatusChange = async (orderId, nextStatus) => {
    setError("");
    setActionMsg("");
    try {
      await updateOrderStatusApi(orderId, nextStatus);
      setActionMsg(`Order updated to '${nextStatus}'.`);
      await loadOrders();
      await refreshNotifications();
    } catch (err) {
      setError(err.message || "Could not update order status");
    }
  };

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="p-6 rounded-xl shadow bg-white text-black text-center space-y-3">
          <p className="text-lg font-semibold">Please login to view orders.</p>
          <Link
            to="/login"
            className="inline-block px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
          >
            Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 text-black">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold dark:text-white">
          {user.role === "customer"
            ? "My Orders"
            : user.role === "seller"
              ? "Seller Orders"
              : "All Orders (Admin)"}
        </h1>
        <button
          onClick={loadOrders}
          className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-500"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-100 text-red-700 border border-red-300">
          {error}
        </div>
      )}

      {actionMsg && (
        <div className="mb-4 p-3 rounded bg-green-100 text-green-800 border border-green-300">
          {actionMsg}
        </div>
      )}

      {loading ? (
        <p className="text-center py-8 dark:text-white">Loading orders...</p>
      ) : orders.length === 0 ? (
        <div className="p-6 rounded-xl shadow bg-white dark:bg-gray-200 text-center">
          <p className="text-lg font-semibold">No orders found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const canCancel =
              (user.role === "customer" || user.role === "admin") &&
              ["pending", "confirmed"].includes(order.status);

            const canUpdateStatus =
              (user.role === "seller" || user.role === "admin") &&
              !["cancelled", "delivered"].includes(order.status);

            const amountToDisplay =
              user.role === "seller" ? order.sellerSubtotal : order.totalAmount;

            return (
              <div
                key={order._id}
                className="p-5 rounded-xl shadow bg-white dark:bg-gray-200 space-y-3"
              >
                <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-3">
                  <div>
                    <p className="text-sm font-mono font-semibold">
                      Order #{order._id}
                    </p>
                    <p className="text-xs text-gray-600">
                      Placed: {new Date(order.createdAt).toLocaleString()}
                    </p>
                    {user.role === "admin" && order.user && (
                      <p className="text-xs text-gray-700 mt-1">
                        Customer: {order.user.name} ({order.user.email})
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase">
                    <span className="px-2.5 py-1 rounded bg-blue-100 text-blue-800">
                      Status: {order.status}
                    </span>
                    <span className="px-2.5 py-1 rounded bg-gray-100 text-gray-800">
                      Payment: {order.paymentMethod} ({order.paymentStatus})
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {order.items.map((item, idx) => (
                    <div
                      key={`${order._id}-${item.product?._id || item.product || idx}`}
                      className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded"
                    >
                      <span>
                        {item.title} × {item.quantity}
                      </span>
                      <span className="font-semibold">
                        ₹ {(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap justify-between items-center gap-3 pt-2 border-t">
                  <p className="text-lg font-bold">
                    {user.role === "seller" ? "Your Items Subtotal" : "Total"}: ₹{" "}
                    {Number(amountToDisplay || 0).toFixed(2)}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {canUpdateStatus && (
                      <>
                        {order.status !== "shipped" && (
                          <button
                            onClick={() =>
                              handleStatusChange(order._id, "shipped")
                            }
                            className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-500"
                          >
                            Mark Shipped
                          </button>
                        )}
                        <button
                          onClick={() =>
                            handleStatusChange(order._id, "delivered")
                          }
                          className="px-3 py-1.5 rounded bg-green-600 text-white text-sm hover:bg-green-500"
                        >
                          Mark Delivered
                        </button>
                      </>
                    )}

                    {canCancel && (
                      <button
                        onClick={() => handleCancelOrder(order._id)}
                        className="px-3 py-1.5 rounded bg-red-600 text-white text-sm hover:bg-red-500"
                      >
                        Cancel Order
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Orders;
