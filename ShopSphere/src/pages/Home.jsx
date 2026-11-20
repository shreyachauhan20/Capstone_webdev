import { useContext, useEffect, useState } from "react";
import ProductCard from "../components/ProductCard";
import Pagination from "../components/Pagination";
import SearchBar from "../components/SearchBar";
import { CartContext } from "../context/CartContext";
import { getCategories, getProducts } from "../utils/api";

function Home() {
  const { inventoryVersion } = useContext(CartContext);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const limit = 8;

  useEffect(() => {
    let active = true;

    const fetchCategories = async () => {
      try {
        const data = await getCategories();
        if (active) {
          setCategories(Array.isArray(data.categories) ? data.categories : []);
        }
      } catch {
        // Categories dropdown falls back cleanly if backend is unavailable
      }
    };

    fetchCategories();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const fetchProducts = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getProducts({
          search: query,
          category,
          sort,
          page,
          limit,
        });
        if (!active) return;
        const list = Array.isArray(data.products) ? data.products : [];
        setProducts(list);
        setTotalPages(Math.max(1, data.totalPages || 1));
      } catch (err) {
        if (!active) return;
        setError(err.message || "Could not load products");
        setProducts([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchProducts();
    return () => {
      active = false;
    };
  }, [query, page, sort, category, inventoryVersion]);

  return (
    <div style={{ padding: "20px" }} className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 dark:text-white">Products</h1>

      <SearchBar query={query} setQuery={setQuery} setPage={setPage} />

      <div className="flex flex-wrap gap-3 mt-2">
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="p-2 border rounded bg-white text-black"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat._id} value={cat.slug}>
              {cat.name}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
          className="p-2 border rounded bg-white text-black"
        >
          <option value="">Sort: Newest</option>
          <option value="low">Price: Low to High</option>
          <option value="high">Price: High to Low</option>
        </select>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded bg-red-100 text-red-700 border border-red-300 font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-center text-lg dark:text-white">
          Loading products...
        </p>
      ) : !error && products.length === 0 ? (
        <p className="mt-8 text-center text-lg text-gray-500 dark:text-gray-300">
          {query || category
            ? "No matching products found."
            : "No products available yet. Run the backend seed script or add products from the dashboard."}
        </p>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          {products.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      ) : null}

      {!loading && !error && products.length > 0 && (
        <Pagination page={page} setPage={setPage} totalPages={totalPages} />
      )}
    </div>
  );
}

export default Home;