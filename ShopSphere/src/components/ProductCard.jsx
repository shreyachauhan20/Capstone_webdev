import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getFallbackThumbnail } from "../utils/imageFallback";

function ProductCard({ product }) {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(false);
  const [failedSrc, setFailedSrc] = useState(null);

  const productId = product._id || product.id;
  const fallbackSrc = getFallbackThumbnail(product);
  const showFallback = !product.thumbnail || failedSrc === product.thumbnail;
  const imageSrc = showFallback ? fallbackSrc : product.thumbnail;

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

  return (
    <div
      className={`
        rounded-xl p-4 shadow-md hover:shadow-lg transition flex flex-col justify-between
        ${isDark ? "bg-gray-700 text-white" : "bg-white text-black"}
      `}
    >
      <div>
        <div
          className={`
            h-44 flex items-center justify-center mb-3 p-2 rounded overflow-hidden
            ${isDark ? "bg-gray-600" : "bg-gray-200"}
          `}
        >
          <img
            src={imageSrc}
            alt={product.title}
            onError={() => {
              if (!showFallback) setFailedSrc(product.thumbnail);
            }}
            className="max-h-full max-w-full object-contain rounded"
          />
        </div>

        {product.category?.name && (
          <p className="text-xs font-medium text-blue-600 dark:text-blue-300 mb-1">
            {product.category.name}
          </p>
        )}

        <h3 className="text-lg font-semibold mb-1">{product.title}</h3>

        {product.brand && (
          <p className="text-xs text-gray-500 dark:text-gray-300 mb-1">
            {product.brand}
          </p>
        )}

        <p className="font-bold text-lg mb-1">
          ₹ {Number(product.price || 0).toLocaleString("en-IN")}
        </p>

        <p
          className={`text-xs mb-3 font-medium ${
            product.stock === 0
              ? "text-red-500"
              : "text-green-600 dark:text-green-400"
          }`}
        >
          {product.stock === 0 ? "Out of Stock" : `In Stock (${product.stock})`}
        </p>
      </div>

      <button
        onClick={() => navigate(`/product/${productId}`)}
        className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
      >
        View
      </button>
    </div>
  );
}

export default ProductCard;