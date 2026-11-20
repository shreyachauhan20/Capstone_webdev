import { useContext, useState } from "react";
import { Link } from "react-router-dom";
import { CartContext } from "../context/CartContext";
import { AuthContext } from "../context/AuthContext";
import { placeOrderApi } from "../utils/api";
import { getFallbackThumbnail } from "../utils/imageFallback";

function Cart() {
  const { user, refreshNotifications } = useContext(AuthContext);
  const {
    cartItems,
    cartTotalAmount,
    cartLoading,
    removeFromCart,
    increaseQty,
    decreaseQty,
    refreshCart,
    notifyInventoryChanged,
  } = useContext(CartContext);

  const [showForm, setShowForm] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [failedImages, setFailedImages] = useState({});

  const [checkoutForm, setCheckoutForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    address: "",
    paymentMethod: "upi",
  });

  const total =
    cartTotalAmount > 0
      ? cartTotalAmount
      : cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-black">
        <h1 className="text-2xl font-bold mb-6 dark:text-white">Cart</h1>
        <div className="p-6 rounded-xl shadow bg-white dark:bg-gray-200 text-center space-y-3">
          <p className="text-xl font-semibold">
            Please login as a customer to view your cart.
          </p>
          <Link
            to="/login"
            className="inline-block px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (user.role !== "customer") {
    return (
      <div className="max-w-4xl mx-auto p-6 text-black">
        <h1 className="text-2xl font-bold mb-6 dark:text-white">Cart</h1>
        <div className="p-6 rounded-xl shadow bg-white dark:bg-gray-200 text-center">
          <p className="text-lg font-semibold">
            Shopping cart is available for customer accounts only.
          </p>
        </div>
      </div>
    );
  }

  const handleCheckout = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const data = await placeOrderApi({
        shippingAddress: {
          name: checkoutForm.name,
          email: checkoutForm.email,
          address: checkoutForm.address,
        },
        paymentMethod: checkoutForm.paymentMethod,
      });

      setPlacedOrder(data.order);
      setShowForm(false);
      notifyInventoryChanged();
      await refreshCart();
      await refreshNotifications();
    } catch (err) {
      setError(err.message || "Could not place order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 text-black">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">Cart</h1>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-100 text-red-700 border border-red-300">
          {error}
        </div>
      )}

      {placedOrder && (
        <div className="mb-6 p-5 rounded-xl shadow bg-green-50 border border-green-300 text-green-900 space-y-2">
          <h2 className="text-lg font-bold">Order placed successfully!</h2>
          <p className="text-sm">
            Order ID: <span className="font-mono font-semibold">{placedOrder._id}</span>
          </p>
          <p className="text-sm">
            Total Paid/Payable: <span className="font-bold">₹ {placedOrder.totalAmount}</span> | Payment Status:{" "}
            <span className="uppercase font-semibold">{placedOrder.paymentStatus}</span> | Order Status:{" "}
            <span className="uppercase font-semibold">{placedOrder.status}</span>
          </p>
          <Link
            to="/orders"
            className="inline-block mt-2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-500"
          >
            View Order History
          </Link>
        </div>
      )}

      {cartLoading ? (
        <div className="p-6 rounded-xl shadow bg-white dark:bg-gray-200 text-center">
          <p className="text-lg font-medium">Loading your cart...</p>
        </div>
      ) : cartItems.length === 0 ? (
        <div className="p-6 rounded-xl shadow bg-white dark:bg-gray-200 text-center">
          <p className="text-xl font-semibold">Your cart is empty!</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {cartItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 rounded-lg shadow bg-white dark:bg-gray-200"
              >
                <div className="w-20 h-20 flex items-center justify-center bg-gray-100 rounded p-1 overflow-hidden shrink-0">
                  <img
                    src={
                      !item.thumbnail ||
                      failedImages[item.id] === item.thumbnail
                        ? getFallbackThumbnail(item)
                        : item.thumbnail
                    }
                    alt={item.title}
                    onError={() => {
                      if (
                        item.thumbnail &&
                        failedImages[item.id] !== item.thumbnail
                      ) {
                        setFailedImages((prev) => ({
                          ...prev,
                          [item.id]: item.thumbnail,
                        }));
                      }
                    }}
                    className="max-w-full max-h-full object-contain rounded"
                  />
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold text-sm">{item.title}</h3>
                  <p className="font-bold text-lg">₹ {item.price}</p>

                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={async () => {
                        setError("");
                        const res = await decreaseQty(item.id);
                        if (res && !res.ok && res.message) setError(res.message);
                      }}
                      className="px-2 bg-gray-300 rounded"
                    >
                      -
                    </button>

                    <span className="font-semibold">{item.quantity}</span>

                    <button
                      onClick={async () => {
                        setError("");
                        const res = await increaseQty(item.id);
                        if (res && !res.ok && res.message) setError(res.message);
                      }}
                      className="px-2 bg-gray-300 rounded"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => removeFromCart(item.id)}
                  className="px-3 py-1 bg-red-500 text-white rounded"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-lg shadow bg-white dark:bg-gray-200">
            <h2 className="text-xl font-semibold mb-3">
              Total: ₹ {total.toFixed(2)}
            </h2>

            <button
              onClick={() => {
                setCheckoutForm((prev) => ({
                  ...prev,
                  name: prev.name || user.name || "",
                  email: prev.email || user.email || "",
                }));
                setShowForm(true);
              }}
              className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
            >
              Checkout
            </button>
          </div>
        </>
      )}

      {showForm && (
        <form
          onSubmit={handleCheckout}
          className="mt-6 p-4 rounded-lg shadow bg-white dark:bg-gray-200 space-y-3"
        >
          <h3 className="text-lg font-semibold">Shipping & Payment Details</h3>

          <input
            type="text"
            placeholder="Name"
            required
            value={checkoutForm.name}
            onChange={(e) =>
              setCheckoutForm({ ...checkoutForm, name: e.target.value })
            }
            className="w-full p-2 border rounded"
          />

          <input
            type="email"
            placeholder="Email"
            required
            value={checkoutForm.email}
            onChange={(e) =>
              setCheckoutForm({ ...checkoutForm, email: e.target.value })
            }
            className="w-full p-2 border rounded"
          />

          <textarea
            placeholder="Address"
            required
            value={checkoutForm.address}
            onChange={(e) =>
              setCheckoutForm({ ...checkoutForm, address: e.target.value })
            }
            className="w-full p-2 border rounded"
          />

          <div className="flex gap-4">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="pay"
                value="card"
                checked={checkoutForm.paymentMethod === "card"}
                onChange={(e) =>
                  setCheckoutForm({
                    ...checkoutForm,
                    paymentMethod: e.target.value,
                  })
                }
                required
              />{" "}
              Card
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="pay"
                value="upi"
                checked={checkoutForm.paymentMethod === "upi"}
                onChange={(e) =>
                  setCheckoutForm({
                    ...checkoutForm,
                    paymentMethod: e.target.value,
                  })
                }
              />{" "}
              UPI
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="pay"
                value="cash"
                checked={checkoutForm.paymentMethod === "cash"}
                onChange={(e) =>
                  setCheckoutForm({
                    ...checkoutForm,
                    paymentMethod: e.target.value,
                  })
                }
              />{" "}
              Cash
            </label>
          </div>

          <label className="block">
            <input type="checkbox" required /> Confirm order and simulated payment
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-60"
          >
            {submitting ? "Placing Order..." : "Place Order"}
          </button>
        </form>
      )}
    </div>
  );
}

export default Cart;