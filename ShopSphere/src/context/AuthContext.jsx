import { createContext, useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  clearStoredAuth,
  getCurrentUser,
  getNotificationsApi,
  getStoredAuth,
  loginUser,
  logoutUser,
  markAllNotificationsReadApi,
  markNotificationReadApi,
  registerUser,
  setStoredAuth,
} from "../utils/api";

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const initial = getStoredAuth();
  const [user, setUser] = useState(initial.user);
  const [accessToken, setAccessToken] = useState(initial.accessToken);
  const [loading, setLoading] = useState(Boolean(initial.accessToken));
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const seenNotificationIdsRef = useRef(new Set());

  const refreshNotifications = useCallback(async () => {
    const stored = getStoredAuth();
    if (!stored.accessToken) {
      seenNotificationIdsRef.current = new Set();
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const data = await getNotificationsApi();
      const list = data.notifications || [];
      seenNotificationIdsRef.current = new Set(
        list.map((n) => n._id).filter(Boolean)
      );
      setNotifications(list);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Non-fatal if notifications fail temporarily
    }
  }, []);

  // Verify stored session on startup
  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      const stored = getStoredAuth();
      if (!stored.accessToken) {
        if (active) setLoading(false);
        return;
      }

      try {
        const data = await getCurrentUser();
        if (active && data.user) {
          setUser(data.user);
          setStoredAuth({ user: data.user });
          await refreshNotifications();
        }
      } catch {
        if (active) {
          clearStoredAuth();
          setUser(null);
          setAccessToken(null);
          setNotifications([]);
          setUnreadCount(0);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    verifySession();

    const handleTokenRefreshed = (e) => {
      setAccessToken(e.detail?.accessToken || null);
    };

    const handleAuthExpired = () => {
      setUser(null);
      setAccessToken(null);
      setNotifications([]);
      setUnreadCount(0);
    };

    window.addEventListener("shopsphere:token-refreshed", handleTokenRefreshed);
    window.addEventListener("shopsphere:auth-expired", handleAuthExpired);

    return () => {
      active = false;
      window.removeEventListener("shopsphere:token-refreshed", handleTokenRefreshed);
      window.removeEventListener("shopsphere:auth-expired", handleAuthExpired);
    };
  }, [refreshNotifications]);

  // Connect Socket.IO with JWT authentication when user is logged in
  useEffect(() => {
    if (!accessToken || !user) return undefined;

    const socket = io({
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
    });

    const handleIncomingNotification = (incoming) => {
      if (!incoming) return;

      if (incoming._id && seenNotificationIdsRef.current.has(incoming._id)) {
        return;
      }
      if (incoming._id) {
        seenNotificationIdsRef.current.add(incoming._id);
      }

      setNotifications((prev) => [incoming, ...prev].slice(0, 50));
      if (!incoming.isRead) {
        setUnreadCount((prev) => prev + 1);
      }
    };

    socket.on("notification", handleIncomingNotification);

    return () => {
      socket.off("notification", handleIncomingNotification);
      socket.disconnect();
    };
  }, [accessToken, user]);

  const login = async ({ email, password }) => {
    const data = await loginUser({ email, password });
    setStoredAuth({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
    await refreshNotifications();
    return data.user;
  };

  const register = async ({ name, email, password, role }) => {
    const data = await registerUser({ name, email, password, role });
    setStoredAuth({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
    await refreshNotifications();
    return data.user;
  };

  const logout = async () => {
    const { refreshToken } = getStoredAuth();
    try {
      await logoutUser(refreshToken);
    } catch {
      // Always clear local session even if token already expired
    } finally {
      clearStoredAuth();
      setUser(null);
      setAccessToken(null);
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  const markAsRead = async (id) => {
    const target = notifications.find((n) => n._id === id);
    if (!target || target.isRead) return;

    try {
      await markNotificationReadApi(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignore transient errors
    }
  };

  const markAllAsRead = async () => {
    try {
      await markAllNotificationsReadApi();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Ignore transient errors
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        loading,
        notifications,
        unreadCount,
        login,
        register,
        logout,
        refreshNotifications,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
