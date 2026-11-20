import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useContext, useRef } from "react";
import { AuthContext } from "../context/AuthContext";
import { CartContext } from "../context/CartContext";

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    logout,
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useContext(AuthContext);
  const { cartItems } = useContext(CartContext);

  const [dark, setDark] = useState(false);
  // Key open state to current navigation entry so route changes close the dropdown automatically
  const currentRouteKey = location.key || `${location.pathname}${location.search}`;
  const [openRouteKey, setOpenRouteKey] = useState(null);
  const showNotifications = openRouteKey === currentRouteKey;

  const alertsContainerRef = useRef(null);

  const toggleDark = () => setDark((d) => !d);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [dark]);

  // Close Alerts dropdown on outside click or Escape key, and clean up listeners
  useEffect(() => {
    if (!showNotifications) return undefined;

    const handleClickOutside = (event) => {
      if (
        alertsContainerRef.current &&
        !alertsContainerRef.current.contains(event.target)
      ) {
        setOpenRouteKey(null);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpenRouteKey(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showNotifications]);

  const handleToggleAlerts = () => {
    setOpenRouteKey((prev) =>
      prev === currentRouteKey ? null : currentRouteKey
    );
  };

  const handleLogout = async () => {
    setOpenRouteKey(null);
    await logout();
    navigate("/login");
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const linkClass = (path) =>
    `text-lg transition ${
      location.pathname === path
        ? "text-white font-semibold border-b-2 border-blue-300"
        : "text-white/90 hover:text-white"
    }`;

  return (
    <nav className="bg-blue-900 shadow-md">
      <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-4 px-6 py-4">
        <Link to="/" className="text-white text-2xl font-bold flex items-center gap-2">
          <span>🛍️</span> ShopSphere
        </Link>

        <div className="flex flex-wrap items-center gap-6">
          <Link to="/" className={`${linkClass("/")} !text-white`}>
            Home
          </Link>

          {(!user || user.role === "customer") && (
            <Link to="/cart" className={`${linkClass("/cart")} !text-white`}>
              Cart{cartCount > 0 ? ` (${cartCount})` : ""}
            </Link>
          )}

          <Link to="/wishlist" className={`${linkClass("/wishlist")} !text-white`}>
            Wishlist
          </Link>

          {user && (
            <Link to="/orders" className={`${linkClass("/orders")} !text-white`}>
              Orders
            </Link>
          )}

          {user && (user.role === "seller" || user.role === "admin") && (
            <Link
              to="/dashboard"
              className={`${linkClass("/dashboard")} !text-white`}
            >
              Dashboard
            </Link>
          )}

          {user && (
            <div className="relative" ref={alertsContainerRef}>
              <button
                type="button"
                aria-expanded={showNotifications}
                aria-haspopup="true"
                onClick={handleToggleAlerts}
                className="px-3 py-1 rounded bg-blue-800 text-white hover:bg-blue-700 text-sm font-medium"
              >
                Alerts{unreadCount > 0 ? ` (${unreadCount})` : ""}
              </button>

              {showNotifications && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-lg shadow-xl bg-white text-black border border-gray-200 z-50 p-3"
                >
                  <div className="flex justify-between items-center pb-2 mb-2 border-b">
                    <span className="font-semibold text-sm">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <p className="text-sm text-gray-500 py-3 text-center">
                      No notifications yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map((notif) => (
                        <div
                          key={notif._id || `${notif.title}-${notif.createdAt}`}
                          onClick={() => {
                            if (notif._id && !notif.isRead) {
                              markAsRead(notif._id);
                            }
                          }}
                          className={`p-2 rounded text-sm cursor-pointer border ${
                            notif.isRead
                              ? "bg-gray-50 border-gray-200 text-gray-600"
                              : "bg-blue-50 border-blue-200 text-black font-medium"
                          }`}
                        >
                          <p className="font-semibold text-xs">{notif.title}</p>
                          <p className="text-xs mt-0.5">{notif.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-blue-200 font-medium">
                {user.name} ({user.role})
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-500 text-sm"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link to="/login" className={`${linkClass("/login")} !text-white`}>
              Login
            </Link>
          )}

          <button
            type="button"
            onClick={toggleDark}
            className="px-3 py-1 rounded bg-blue-700 text-white hover:bg-blue-600"
          >
            {dark ? "Light" : "Dark"}
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;