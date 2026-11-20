import { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import { CartContext } from "../context/CartContext";
import { getProductById } from "../utils/api";
import { getFallbackThumbnail } from "../utils/imageFallback";

function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isErrorMsg, setIsErrorMsg] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [failedSrc, setFailedSrc] = useState(null);

  const { addToCart, addToWishlist, inventoryVersion } = useContext(CartContext);

  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };

    checkDark();

    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;

    const fetchProduct = async () => {
      setLoading(true);
      setError("");
      setFailedSrc(null);
      try {
        const data = await getProductById(id);
        if (active) setProduct(data.product || null);
      } catch (err) {
        if (active) setError(err.message || "Product not found");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchProduct();
    return () => {
      active = false;
    };
  }, [id, inventoryVersion]);

  if (loading) {
    return (
      <p className="text-center mt-10 text-lg dark:text-white">Loading...</p>
    );
  }

  if (error || !product) {
    return (
      <p className="text-center mt-10 text-lg text-red-600">
        {error || "Product not found"}
      </p>
    );
  }

  const handleAddToCart = async () => {
    const res = await addToCart(product, 1);
    setIsErrorMsg(!res.ok);
    setMessage(res.message);
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div
        className={`
          flex flex-col md:flex-row gap-6 p-6 rounded-xl shadow-md
          ${isDark ? "bg-gray-700 text-white" : "bg-white text-black"}
        `}
      >
        <div
          className={`
            flex-1 flex justify-center items-center rounded min-h-72 p-4 overflow-hidden
            ${isDark ? "bg-gray-600" : "bg-gray-100"}
          `}
        >
          <img
            src={
              !product.thumbnail || failedSrc === product.thumbnail
                ? getFallbackThumbnail(product)
                : product.thumbnail
            }
            alt={product.title}
            onError={() => {
              if (product.thumbnail && failedSrc !== product.thumbnail) {
                setFailedSrc(product.thumbnail);
              }
            }}
            className="max-h-80 max-w-full object-contain rounded"
          />
        </div>

        <div className="flex-1 flex flex-col justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">{product.title}</h1>

            <p
              className={`mb-4 ${
                isDark ? "text-gray-200" : "text-gray-600"
              }`}
            >
              {product.description}
            </p>

            <p className="text-xl font-semibold mb-2">
              ₹ {Number(product.price || 0).toLocaleString("en-IN")}
            </p>

            <p
              className={`text-sm mb-1 ${
                isDark ? "text-gray-300" : "text-gray-500"
              }`}
            >
              Brand: {product.brand || "Generic"}
            </p>

            {product.category?.name && (
              <p
                className={`text-sm mb-1 ${
                  isDark ? "text-gray-300" : "text-gray-500"
                }`}
              >
                Category: {product.category.name}
              </p>
            )}

            {product.seller?.name && (
              <p
                className={`text-sm mb-1 ${
                  isDark ? "text-gray-300" : "text-gray-500"
                }`}
              >
                Seller: {product.seller.name}
              </p>
            )}

            <p
              className={`text-sm font-semibold mb-4 ${
                product.stock === 0 ? "text-red-500" : "text-green-600"
              }`}
            >
              {product.stock === 0
                ? "Out of Stock"
                : `Available Stock: ${product.stock}`}
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleAddToCart}
              disabled={product.stock === 0}
              className={`flex-1 py-2 rounded text-white ${
                product.stock === 0
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500"
              }`}
            >
              {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
            </button>

            <button
              onClick={() => {
                addToWishlist(product);
                setIsErrorMsg(false);
                setMessage("Added to Wishlist");
              }}
              className="flex-1 py-2 rounded bg-green-600 text-white hover:bg-green-500"
            >
              Wishlist
            </button>
          </div>

          {message && (
            <p
              className={`mt-3 font-medium ${
                isErrorMsg ? "text-red-500" : "text-green-500"
              }`}
            >
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductDetail;