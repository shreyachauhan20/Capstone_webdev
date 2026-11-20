const ACCESS_TOKEN_KEY = "shopsphere_access_token";
const REFRESH_TOKEN_KEY = "shopsphere_refresh_token";
const USER_STORAGE_KEY = "shopsphere_user";

export const getStoredAuth = () => {
  try {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_STORAGE_KEY);
    const user = rawUser ? JSON.parse(rawUser) : null;
    return { accessToken, refreshToken, user };
  } catch {
    return { accessToken: null, refreshToken: null, user: null };
  }
};

export const setStoredAuth = ({ accessToken, refreshToken, user }) => {
  if (accessToken !== undefined) {
    if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    else localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
  if (refreshToken !== undefined) {
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    else localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
  if (user !== undefined) {
    if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_STORAGE_KEY);
  }
};

export const clearStoredAuth = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
};

let refreshPromise = null;

export const refreshAccessToken = async () => {
  if (refreshPromise) return refreshPromise;

  const { refreshToken } = getStoredAuth();
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  refreshPromise = (async () => {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.accessToken) {
      clearStoredAuth();
      window.dispatchEvent(new CustomEvent("shopsphere:auth-expired"));
      throw new Error(data.message || "Session expired, please login again");
    }

    setStoredAuth({ accessToken: data.accessToken });
    window.dispatchEvent(
      new CustomEvent("shopsphere:token-refreshed", {
        detail: { accessToken: data.accessToken },
      })
    );
    return data.accessToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
};

const SKIP_REFRESH_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
];

export const apiFetch = async (path, options = {}, hasRetried = false) => {
  const { accessToken } = getStoredAuth();
  const headers = { ...(options.headers || {}) };

  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (accessToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(path, {
    cache: "no-store",
    ...options,
    headers,
  });

  if (
    res.status === 401 &&
    !hasRetried &&
    !SKIP_REFRESH_PATHS.some((p) => path.startsWith(p))
  ) {
    const { refreshToken } = getStoredAuth();
    if (refreshToken) {
      try {
        const newToken = await refreshAccessToken();
        return apiFetch(
          path,
          {
            ...options,
            headers: {
              ...(options.headers || {}),
              Authorization: `Bearer ${newToken}`,
            },
          },
          true
        );
      } catch (refreshError) {
        const err = new Error(refreshError.message || "Unauthorized");
        err.status = 401;
        throw err;
      }
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
};

// ================= AUTH =================
export const registerUser = (payload) =>
  apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const loginUser = (payload) =>
  apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const logoutUser = (refreshToken) =>
  apiFetch("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
  });

export const getCurrentUser = () => apiFetch("/api/auth/me");

// ================= PRODUCTS =================
export const getProducts = ({
  search = "",
  category = "",
  sort = "",
  page = 1,
  limit = 8,
  minPrice = "",
  maxPrice = "",
  inStock = "",
} = {}) => {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (category) params.set("category", category);
  if (sort) params.set("sort", sort);
  if (page) params.set("page", String(page));
  if (limit) params.set("limit", String(limit));
  if (minPrice !== "") params.set("minPrice", String(minPrice));
  if (maxPrice !== "") params.set("maxPrice", String(maxPrice));
  if (inStock !== "") params.set("inStock", String(inStock));
  return apiFetch(`/api/products?${params.toString()}`);
};

export const getProductById = (id) => apiFetch(`/api/products/${id}`);

export const createProduct = (payload) =>
  apiFetch("/api/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateProduct = (id, payload) =>
  apiFetch(`/api/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteProduct = (id) =>
  apiFetch(`/api/products/${id}`, {
    method: "DELETE",
  });

// ================= CATEGORIES =================
export const getCategories = () => apiFetch("/api/categories");

export const createCategory = (payload) =>
  apiFetch("/api/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateCategory = (id, payload) =>
  apiFetch(`/api/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteCategory = (id) =>
  apiFetch(`/api/categories/${id}`, {
    method: "DELETE",
  });

// ================= CART =================
export const getCartApi = () => apiFetch("/api/cart");

export const addToCartApi = (productId, quantity = 1) =>
  apiFetch("/api/cart", {
    method: "POST",
    body: JSON.stringify({ productId, quantity }),
  });

export const updateCartItemApi = (productId, quantity) =>
  apiFetch(`/api/cart/${productId}`, {
    method: "PUT",
    body: JSON.stringify({ quantity }),
  });

export const removeCartItemApi = (productId) =>
  apiFetch(`/api/cart/${productId}`, {
    method: "DELETE",
  });

export const clearCartApi = () =>
  apiFetch("/api/cart", {
    method: "DELETE",
  });

// ================= ORDERS =================
export const placeOrderApi = (payload) =>
  apiFetch("/api/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getOrdersApi = () => apiFetch("/api/orders");

export const getSellerOrdersApi = () => apiFetch("/api/orders/seller");

export const getAdminOrdersApi = () => apiFetch("/api/orders/admin");

export const getOrderByIdApi = (id) => apiFetch(`/api/orders/${id}`);

export const cancelOrderApi = (id) =>
  apiFetch(`/api/orders/${id}/cancel`, {
    method: "PATCH",
  });

export const updateOrderStatusApi = (id, status) =>
  apiFetch(`/api/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

// ================= INVENTORY =================
export const getInventoryApi = () => apiFetch("/api/inventory");

export const getLowStockApi = () => apiFetch("/api/inventory/low-stock");

export const updateStockApi = (productId, payload) =>
  apiFetch(`/api/inventory/${productId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const getInventoryLogsApi = (productId = "") =>
  apiFetch(
    productId ? `/api/inventory/logs/${productId}` : "/api/inventory/logs"
  );

// ================= ANALYTICS =================
export const getSalesReportApi = () => apiFetch("/api/analytics/sales");

export const getBestSellersApi = (limit = 5) =>
  apiFetch(`/api/analytics/best-sellers?limit=${limit}`);

export const getInventorySummaryApi = () =>
  apiFetch("/api/analytics/inventory-summary");

// ================= NOTIFICATIONS =================
export const getNotificationsApi = () => apiFetch("/api/notifications");

export const markNotificationReadApi = (id) =>
  apiFetch(`/api/notifications/${id}/read`, {
    method: "PATCH",
  });

export const markAllNotificationsReadApi = () =>
  apiFetch("/api/notifications/read-all", {
    method: "PATCH",
  });