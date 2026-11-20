import { useContext, useState } from "react";
import { CartContext } from "../context/CartContext";
import { getFallbackThumbnail } from "../utils/imageFallback";

function Wishlist() {
  const { wishlistItems, removeFromWishlist } =
    useContext(CartContext);
  const [failedImages, setFailedImages] = useState({});

  return (
    <div className="max-w-4xl mx-auto p-6 text-black dark:text-black">
      <h1 className="text-2xl font-bold mb-6">Wishlist</h1>

      {wishlistItems.length === 0 ? (
        <div className="p-6 rounded-xl shadow bg-white dark:bg-gray-200 text-center">
          <p className="text-xl font-semibold">
            Your wishlist is empty!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {wishlistItems.map((item) => (
            <div
              key={item.id}
              className="
                flex items-center gap-4 p-4 rounded-lg shadow
                bg-white dark:bg-gray-200
              "
            >
      
              <div className="w-20 h-20 flex items-center justify-center bg-gray-100 rounded p-1 overflow-hidden shrink-0">
                <img
                  src={
                    !item.thumbnail || failedImages[item.id] === item.thumbnail
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
                <h3 className="text-lg font-semibold">
                  {item.title}
                </h3>
                <p className="font-bold text-lg">
                  ₹ {item.price}
                </p>
              </div>

    
              <button
                onClick={() => removeFromWishlist(item.id)}
                className="
                  px-3 py-1 rounded
                  bg-red-500 text-white
                  hover:bg-red-600
                "
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Wishlist;