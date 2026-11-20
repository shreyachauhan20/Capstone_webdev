import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AuthContext } from "./AuthContext";
import {
  addToCartApi,
  clearCartApi,
  getCartApi,
  removeCartItemApi,
  updateCartItemApi,
} from "../utils/api";

// eslint-disable-next-line react-refresh/only-export-components
export const CartContext = createContext();

const WISHLIST_KEY = "shopsphere_wishlist";

const normalizeProduct = (product) => ({
  id: product._id || product.id,
  _id: product._id || product.id,
  title: product.title,
  price: Number(product.price) || 0,
  thumbnail: product.thumbnail || "",
  brand: product.brand || "Generic",
  stock: typeof product.stock === "number" ? product.stock : 0,
  isActive: product.isActive !== undefined ? product.isActive : true,
});

const mapBackendCartItems = (cart) => {
  if (!cart || !Array.isArray(cart.items)) return [];
  return cart.items
    .filter((entry) => entry.product)
    .map((entry) => ({
      ...normalizeProduct(entry.product),
      quantity: entry.quantity,
      subtotal: entry.subtotal,
    }));
};

const CartProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [cartItems, setCartItems] = useState([]);
  const [cartTotalAmount, setCartTotalAmount] = useState(0);
  const [cartLoading, setCartLoading] = useState(false);
  const [inventoryVersion, setInventoryVersion] = useState(0);

  const notifyInventoryChanged = useCallback(() => {
    setInventoryVersion((v) => v + 1);
  }, []);

  const [wishlistItems, setWishlistItems] = useState(() => {
    try {
      const saved = localStorage.getItem(WISHLIST_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlistItems));
    } catch {
      // Ignore storage errors
    }
  }, [wishlistItems]);

  const applyBackendCart = (cart) => {
    setCartItems(mapBackendCartItems(cart));
    setCartTotalAmount(Number(cart?.totalAmount || 0));
  };

  const refreshCart = useCallback(async () => {
    if (!user || user.role !== "customer") {
      setCartItems([]);
      setCartTotalAmount(0);
      return;
    }

    setCartLoading(true);
    try {
      const data = await getCartApi();
      applyBackendCart(data.cart);
    } catch {
      setCartItems([]);
      setCartTotalAmount(0);
    } finally {
      setCartLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    const syncCart = async () => {
      if (!user || user.role !== "customer") {
        if (active) {
          setCartItems([]);
          setCartTotalAmount(0);
        }
        return;
      }
      if (active) setCartLoading(true);
      try {
        const data = await getCartApi();
        if (active) applyBackendCart(data.cart);
      } catch {
        if (active) {
          setCartItems([]);
          setCartTotalAmount(0);
        }
      } finally {
        if (active) setCartLoading(false);
      }
    };

    syncCart();
    return () => {
      active = false;
    };
  }, [user]);

  const addToCart = async (product, quantity = 1) => {
    if (!user) {
      return { ok: false, message: "Please login as a customer to add items to cart" };
    }
    if (user.role !== "customer") {
      return { ok: false, message: "Only customer accounts can use the shopping cart" };
    }

    const productId = product._id || product.id;
    try {
      const data = await addToCartApi(productId, quantity);
      applyBackendCart(data.cart);
      return { ok: true, message: "Added to Cart" };
    } catch (error) {
      return { ok: false, message: error.message || "Could not add item to cart" };
    }
  };

  const removeFromCart = async (id) => {
    if (!user || user.role !== "customer") return;
    try {
      const data = await removeCartItemApi(id);
      applyBackendCart(data.cart);
    } catch {
      await refreshCart();
    }
  };

  const increaseQty = async (id) => {
    if (!user || user.role !== "customer") return { ok: false };
    const existing = cartItems.find((item) => item.id === id);
    if (!existing) return { ok: false };

    try {
      const data = await updateCartItemApi(id, existing.quantity + 1);
      applyBackendCart(data.cart);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  };

  const decreaseQty = async (id) => {
    if (!user || user.role !== "customer") return { ok: false };
    const existing = cartItems.find((item) => item.id === id);
    if (!existing) return { ok: false };

    try {
      if (existing.quantity <= 1) {
        const data = await removeCartItemApi(id);
        applyBackendCart(data.cart);
      } else {
        const data = await updateCartItemApi(id, existing.quantity - 1);
        applyBackendCart(data.cart);
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  };

  const clearCart = async () => {
    if (!user || user.role !== "customer") {
      setCartItems([]);
      setCartTotalAmount(0);
      return;
    }

    try {
      const data = await clearCartApi();
      applyBackendCart(data.cart);
    } catch {
      setCartItems([]);
      setCartTotalAmount(0);
    }
  };

  const addToWishlist = (product) => {
    const normalized = normalizeProduct(product);
    setWishlistItems((prev) => {
      const exists = prev.find((item) => item.id === normalized.id);
      if (exists) return prev;
      return [...prev, normalized];
    });
  };

  const removeFromWishlist = (id) => {
    setWishlistItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartTotalAmount,
        cartLoading,
        inventoryVersion,
        wishlistItems,
        refreshCart,
        notifyInventoryChanged,
        addToCart,
        removeFromCart,
        increaseQty,
        decreaseQty,
        clearCart,
        addToWishlist,
        removeFromWishlist,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export default CartProvider;