import { useCallback, useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  getBestSellersApi,
  getCategories,
  getInventoryApi,
  getInventoryLogsApi,
  getInventorySummaryApi,
  getSalesReportApi,
  updateProduct,
  updateStockApi,
} from "../utils/api";

function Dashboard() {
  const { user, refreshNotifications } = useContext(AuthContext);

  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  // Analytics state
  const [salesReport, setSalesReport] = useState(null);
  const [bestSellers, setBestSellers] = useState([]);
  const [inventorySummary, setInventorySummary] = useState(null);

  // Inventory & logs
  const [inventoryProducts, setInventoryProducts] = useState([]);
  const [stockDrafts, setStockDrafts] = useState({});
  const [logs, setLogs] = useState([]);

  // Categories & Product creation / editing
  const [categories, setCategories] = useState([]);
  const [editingProductId, setEditingProductId] = useState(null);
  const [newProduct, setNewProduct] = useState({
    title: "",
    description: "",
    price: "",
    brand: "",
    thumbnail: "",
    stock: "10",
    lowStockThreshold: "5",
    category: "",
  });

  const [newCategory, setNewCategory] = useState({
    name: "",
    description: "",
  });

  const loadDashboardData = useCallback(async () => {
    if (!user || !["seller", "admin"].includes(user.role)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [sales, best, invSum, inv, logRes, catRes] = await Promise.all([
        getSalesReportApi(),
        getBestSellersApi(5),
        getInventorySummaryApi(),
        getInventoryApi(),
        getInventoryLogsApi(),
        getCategories(),
      ]);

      setSalesReport(sales);
      setBestSellers(best.bestSellers || []);
      setInventorySummary(invSum);
      setInventoryProducts(inv.products || []);
      setLogs(logRes.logs || []);
      setCategories(catRes.categories || []);

      const initialDrafts = {};
      (inv.products || []).forEach((p) => {
        initialDrafts[p._id] = String(p.stock);
      });
      setStockDrafts(initialDrafts);

      if ((catRes.categories || []).length > 0) {
        setNewProduct((prev) => ({
          ...prev,
          category: prev.category || catRes.categories[0]._id,
        }));
      }
    } catch (err) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) loadDashboardData();
    });
    return () => {
      active = false;
    };
  }, [loadDashboardData]);

  const handleStockUpdate = async (productId) => {
    setError("");
    setFeedback("");
    const parsed = Number(stockDrafts[productId]);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError("Stock must be a non-negative whole number.");
      return;
    }

    try {
      await updateStockApi(productId, {
        stock: parsed,
        note: "Updated from Seller/Admin Dashboard",
      });
      setFeedback("Stock updated successfully.");
      await loadDashboardData();
      await refreshNotifications();
    } catch (err) {
      setError(err.message || "Could not update stock");
    }
  };

  const resetProductForm = (defaultCategoryId = categories[0]?._id || "") => {
    setEditingProductId(null);
    setNewProduct({
      title: "",
      description: "",
      price: "",
      brand: "",
      thumbnail: "",
      stock: "10",
      lowStockThreshold: "5",
      category: defaultCategoryId,
    });
  };

  const handleStartEditProduct = (product) => {
    setError("");
    setFeedback("");
    setEditingProductId(product._id);
    setNewProduct({
      title: product.title || "",
      description: product.description || "",
      price: String(product.price ?? ""),
      brand: product.brand || "",
      thumbnail: product.thumbnail || "",
      stock: String(product.stock ?? 0),
      lowStockThreshold: String(product.lowStockThreshold ?? 5),
      category: product.category?._id || product.category || categories[0]?._id || "",
    });
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setError("");
    setFeedback("");
    const payload = {
      title: newProduct.title,
      description: newProduct.description,
      price: Number(newProduct.price),
      brand: newProduct.brand || "Generic",
      thumbnail: newProduct.thumbnail,
      stock: Number(newProduct.stock),
      lowStockThreshold: Number(newProduct.lowStockThreshold),
      category: newProduct.category,
    };

    try {
      if (editingProductId) {
        await updateProduct(editingProductId, payload);
        setFeedback("Product updated successfully.");
      } else {
        await createProduct(payload);
        setFeedback("Product created successfully.");
      }
      resetProductForm();
      await loadDashboardData();
    } catch (err) {
      setError(
        err.message ||
          (editingProductId ? "Could not update product" : "Could not create product")
      );
    }
  };

  const handleDeleteProduct = async (productId) => {
    setError("");
    setFeedback("");
    try {
      await deleteProduct(productId);
      setFeedback("Product deleted.");
      await loadDashboardData();
    } catch (err) {
      setError(err.message || "Could not delete product");
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    setError("");
    setFeedback("");
    try {
      await createCategory(newCategory);
      setFeedback("Category created successfully.");
      setNewCategory({ name: "", description: "" });
      await loadDashboardData();
    } catch (err) {
      setError(err.message || "Could not create category");
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    setError("");
    setFeedback("");
    try {
      await deleteCategory(categoryId);
      setFeedback("Category deleted.");
      await loadDashboardData();
    } catch (err) {
      setError(err.message || "Could not delete category");
    }
  };

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="p-6 rounded-xl shadow bg-white text-black text-center space-y-3">
          <p className="text-lg font-semibold">
            Please login as a Seller or Admin to access the dashboard.
          </p>
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

  if (!["seller", "admin"].includes(user.role)) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="p-6 rounded-xl shadow bg-white text-black text-center">
          <p className="text-lg font-semibold">
            Access denied: Dashboard is for Seller and Admin accounts only.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 text-black">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">
            {user.role === "admin" ? "Admin Dashboard" : "Seller Dashboard"}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Analytics, inventory management, products, and audit logs
          </p>
        </div>

        <button
          onClick={loadDashboardData}
          className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-500"
        >
          Refresh Data
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: "overview", label: "Analytics" },
          { key: "inventory", label: "Inventory & Stock" },
          { key: "products", label: "Products" },
          { key: "logs", label: "Inventory Logs" },
          ...(user.role === "admin"
            ? [{ key: "categories", label: "Categories" }]
            : []),
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`px-4 py-2 rounded font-medium text-sm ${
              tab === item.key
                ? "bg-blue-700 text-white"
                : "bg-white text-black border border-gray-300 hover:bg-gray-100"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-100 text-red-700 border border-red-300">
          {error}
        </div>
      )}

      {feedback && (
        <div className="mb-4 p-3 rounded bg-green-100 text-green-800 border border-green-300">
          {feedback}
        </div>
      )}

      {loading ? (
        <p className="text-center py-8 dark:text-white">
          Loading dashboard data...
        </p>
      ) : (
        <>
          {tab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl shadow bg-white dark:bg-gray-200">
                  <p className="text-xs text-gray-600 uppercase font-semibold">
                    Total Revenue
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    ₹ {Number(salesReport?.totalRevenue || 0).toFixed(2)}
                  </p>
                </div>

                <div className="p-4 rounded-xl shadow bg-white dark:bg-gray-200">
                  <p className="text-xs text-gray-600 uppercase font-semibold">
                    Total Orders
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    {salesReport?.totalOrders || 0}
                  </p>
                </div>

                <div className="p-4 rounded-xl shadow bg-white dark:bg-gray-200">
                  <p className="text-xs text-gray-600 uppercase font-semibold">
                    Inventory Value
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    ₹{" "}
                    {Number(
                      inventorySummary?.summary?.totalInventoryValue || 0
                    ).toFixed(2)}
                  </p>
                </div>

                <div className="p-4 rounded-xl shadow bg-white dark:bg-gray-200">
                  <p className="text-xs text-gray-600 uppercase font-semibold">
                    Low / Out of Stock
                  </p>
                  <p className="text-2xl font-bold mt-1 text-red-600">
                    {inventorySummary?.summary?.lowStockCount || 0} /{" "}
                    {inventorySummary?.summary?.outOfStockCount || 0}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl shadow bg-white dark:bg-gray-200">
                  <h2 className="text-lg font-bold mb-3">
                    Best-Selling Products
                  </h2>
                  {bestSellers.length === 0 ? (
                    <p className="text-sm text-gray-600">No sales yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {bestSellers.map((item) => (
                        <div
                          key={item.productId}
                          className="flex justify-between items-center p-2 rounded bg-gray-50 text-sm"
                        >
                          <div>
                            <p className="font-semibold">{item.productName}</p>
                            <p className="text-xs text-gray-600">
                              Units sold: {item.unitsSold}
                            </p>
                          </div>
                          <span className="font-bold">
                            ₹ {Number(item.revenueGenerated || 0).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-5 rounded-xl shadow bg-white dark:bg-gray-200">
                  <h2 className="text-lg font-bold mb-3">
                    Inventory by Category
                  </h2>
                  {!inventorySummary?.byCategory?.length ? (
                    <p className="text-sm text-gray-600">
                      No inventory categories found.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {inventorySummary.byCategory.map((cat) => (
                        <div
                          key={cat.categoryId || cat.categoryName}
                          className="flex justify-between items-center p-2 rounded bg-gray-50 text-sm"
                        >
                          <div>
                            <p className="font-semibold">{cat.categoryName}</p>
                            <p className="text-xs text-gray-600">
                              {cat.productCount} products • {cat.totalUnits}{" "}
                              units
                            </p>
                          </div>
                          <span className="font-bold">
                            ₹ {Number(cat.inventoryValue || 0).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "inventory" && (
            <div className="p-5 rounded-xl shadow bg-white dark:bg-gray-200 space-y-3">
              <h2 className="text-lg font-bold mb-2">
                Inventory Levels & Stock Control
              </h2>
              {inventoryProducts.length === 0 ? (
                <p className="text-sm text-gray-600">No products found.</p>
              ) : (
                <div className="space-y-3">
                  {inventoryProducts.map((p) => {
                    const isLow = p.stock <= p.lowStockThreshold;
                    return (
                      <div
                        key={p._id}
                        className="flex flex-wrap justify-between items-center gap-3 p-3 rounded border bg-gray-50"
                      >
                        <div>
                          <p className="font-semibold">{p.title}</p>
                          <p className="text-xs text-gray-600">
                            Price: ₹ {p.price} • Threshold: {p.lowStockThreshold}
                          </p>
                          {isLow && (
                            <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-700">
                              {p.stock === 0 ? "Out of Stock" : "Low Stock"}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={stockDrafts[p._id] ?? String(p.stock)}
                            onChange={(e) =>
                              setStockDrafts((prev) => ({
                                ...prev,
                                [p._id]: e.target.value,
                              }))
                            }
                            className="w-24 p-1.5 border rounded bg-white"
                          />
                          <button
                            onClick={() => handleStockUpdate(p._id)}
                            className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-500"
                          >
                            Update Stock
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "products" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <form
                onSubmit={handleSaveProduct}
                className="p-5 rounded-xl shadow bg-white dark:bg-gray-200 space-y-3"
              >
                <h2 className="text-lg font-bold">
                  {editingProductId ? "Edit Product" : "Add New Product"}
                </h2>

                <input
                  type="text"
                  placeholder="Product Title"
                  required
                  value={newProduct.title}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, title: e.target.value })
                  }
                  className="w-full p-2 border rounded bg-white"
                />

                <textarea
                  placeholder="Description"
                  required
                  value={newProduct.description}
                  onChange={(e) =>
                    setNewProduct({
                      ...newProduct,
                      description: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded bg-white"
                />

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Price"
                    required
                    value={newProduct.price}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, price: e.target.value })
                    }
                    className="w-full p-2 border rounded bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Brand"
                    value={newProduct.brand}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, brand: e.target.value })
                    }
                    className="w-full p-2 border rounded bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="Initial Stock"
                    required
                    value={newProduct.stock}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, stock: e.target.value })
                    }
                    className="w-full p-2 border rounded bg-white"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Low Stock Alert"
                    required
                    value={newProduct.lowStockThreshold}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        lowStockThreshold: e.target.value,
                      })
                    }
                    className="w-full p-2 border rounded bg-white"
                  />
                </div>

                <select
                  required
                  value={newProduct.category}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, category: e.target.value })
                  }
                  className="w-full p-2 border rounded bg-white"
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Thumbnail Image URL (https://... optional)"
                  value={newProduct.thumbnail}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, thumbnail: e.target.value })
                  }
                  className="w-full p-2 border rounded bg-white"
                />

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded bg-green-600 text-white hover:bg-green-500"
                  >
                    {editingProductId ? "Save Changes" : "Create Product"}
                  </button>
                  {editingProductId && (
                    <button
                      type="button"
                      onClick={() => resetProductForm()}
                      className="px-4 py-2 rounded bg-gray-300 text-black hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="p-5 rounded-xl shadow bg-white dark:bg-gray-200 space-y-3">
                <h2 className="text-lg font-bold">
                  Manage Products ({inventoryProducts.length})
                </h2>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {inventoryProducts.map((p) => (
                    <div
                      key={p._id}
                      className="flex justify-between items-center p-2.5 rounded bg-gray-50 border text-sm"
                    >
                      <div>
                        <p className="font-semibold">{p.title}</p>
                        <p className="text-xs text-gray-600">
                          ₹ {p.price} • Stock: {p.stock}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStartEditProduct(p)}
                          className="px-3 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-500"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p._id)}
                          className="px-3 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-500"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "logs" && (
            <div className="p-5 rounded-xl shadow bg-white dark:bg-gray-200 space-y-3">
              <h2 className="text-lg font-bold">Recent Inventory Logs</h2>
              {logs.length === 0 ? (
                <p className="text-sm text-gray-600">No inventory logs yet.</p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log._id}
                      className="flex flex-wrap justify-between items-center p-3 rounded bg-gray-50 border text-sm"
                    >
                      <div>
                        <p className="font-semibold">
                          {log.product?.title || "Product"} —{" "}
                          <span className="uppercase text-xs text-blue-700">
                            {log.changeType}
                          </span>
                        </p>
                        <p className="text-xs text-gray-600">
                          {log.note} • By {log.changedBy?.name || "System"} (
                          {log.changedBy?.role || "user"})
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-bold ${
                            log.quantityChanged >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {log.quantityChanged >= 0
                            ? `+${log.quantityChanged}`
                            : log.quantityChanged}
                        </p>
                        <p className="text-xs text-gray-600">
                          {log.previousStock} → {log.newStock}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "categories" && user.role === "admin" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <form
                onSubmit={handleCreateCategory}
                className="p-5 rounded-xl shadow bg-white dark:bg-gray-200 space-y-3"
              >
                <h2 className="text-lg font-bold">Add Category</h2>
                <input
                  type="text"
                  placeholder="Category Name"
                  required
                  value={newCategory.name}
                  onChange={(e) =>
                    setNewCategory({ ...newCategory, name: e.target.value })
                  }
                  className="w-full p-2 border rounded bg-white"
                />
                <textarea
                  placeholder="Description (optional)"
                  value={newCategory.description}
                  onChange={(e) =>
                    setNewCategory({
                      ...newCategory,
                      description: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded bg-white"
                />
                <button
                  type="submit"
                  className="w-full py-2 rounded bg-blue-600 text-white hover:bg-blue-500"
                >
                  Create Category
                </button>
              </form>

              <div className="p-5 rounded-xl shadow bg-white dark:bg-gray-200 space-y-2">
                <h2 className="text-lg font-bold">Existing Categories</h2>
                {categories.map((cat) => (
                  <div
                    key={cat._id}
                    className="flex justify-between items-center p-2.5 rounded bg-gray-50 border text-sm"
                  >
                    <div>
                      <p className="font-semibold">{cat.name}</p>
                      <p className="text-xs text-gray-600">/{cat.slug}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(cat._id)}
                      className="px-3 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-500"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Dashboard;
