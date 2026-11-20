const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const Product = require("../models/Product");

// Validate that quantity is a positive whole number (1, 2, 3, ...)
const parsePositiveInteger = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const num = Number(value);
  if (!Number.isInteger(num) || num < 1) {
    return null;
  }

  return num;
};

// Build consistent cart response with prices and totals calculated on the backend
const formatCartResponse = (cart) => {
  if (!cart || !cart.items || cart.items.length === 0) {
    return {
      items: [],
      totalItems: 0,
      totalAmount: 0,
    };
  }

  const formattedItems = [];
  let totalItems = 0;
  let totalAmount = 0;

  for (const item of cart.items) {
    if (!item.product) {
      continue;
    }

    const price = Number(item.product.price) || 0;
    const subtotal = Number((price * item.quantity).toFixed(2));

    totalItems += item.quantity;
    totalAmount += subtotal;

    formattedItems.push({
      product: {
        _id: item.product._id,
        title: item.product.title,
        price,
        thumbnail: item.product.thumbnail,
        brand: item.product.brand,
        stock: item.product.stock,
        isActive: item.product.isActive,
      },
      quantity: item.quantity,
      subtotal,
    });
  }

  return {
    _id: cart._id,
    user: cart.user,
    items: formattedItems,
    totalItems,
    totalAmount: Number(totalAmount.toFixed(2)),
  };
};

// @desc    Get logged-in customer's cart
// @route   GET /api/cart
// @access  Customer only
const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product",
      "title price thumbnail stock isActive brand"
    );

    if (!cart || cart.items.length === 0) {
      return res.status(200).json({
        message: "Cart is empty",
        cart: formatCartResponse(null),
      });
    }

    return res.status(200).json({
      cart: formatCartResponse(cart),
    });
  } catch (error) {
    console.error("Get cart error:", error.message);
    return res.status(500).json({
      message: "Server error while fetching cart",
    });
  }
};

// @desc    Add a product to cart or increase its quantity
// @route   POST /api/cart
// @access  Customer only
const addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    // 1. Validate product ID
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        message: "A valid productId is required",
      });
    }

    // 2. Validate quantity (defaults to 1 only if omitted; rejects 0, negatives, decimals)
    const parsedQty =
      quantity === undefined ? 1 : parsePositiveInteger(quantity);

    if (parsedQty === null) {
      return res.status(400).json({
        message: "Quantity must be a positive whole number",
      });
    }

    // 3. Look up product in database (never trust frontend prices or stock)
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    if (!product.isActive) {
      return res.status(400).json({
        message: "This product is currently unavailable",
      });
    }

    // 4. Find or create the logged-in customer's cart
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({
        user: req.user._id,
        items: [],
      });
    }

    // 5. Prevent duplicate cart entries by updating quantity if product already exists
    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId
    );

    const updatedQuantity = existingItem
      ? existingItem.quantity + parsedQty
      : parsedQty;

    if (updatedQuantity > product.stock) {
      return res.status(400).json({
        message: `Insufficient stock. Available stock: ${product.stock}`,
      });
    }

    if (existingItem) {
      existingItem.quantity = updatedQuantity;
    } else {
      cart.items.push({
        product: product._id,
        quantity: parsedQty,
      });
    }

    await cart.save();
    await cart.populate(
      "items.product",
      "title price thumbnail stock isActive brand"
    );

    return res.status(200).json({
      message: "Product added to cart",
      cart: formatCartResponse(cart),
    });
  } catch (error) {
    console.error("Add to cart error:", error.message);
    return res.status(500).json({
      message: "Server error while adding item to cart",
    });
  }
};

// @desc    Update quantity of a specific product in the cart
// @route   PUT /api/cart/:productId
// @access  Customer only
const updateCartItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    // 1. Validate product ID and quantity
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        message: "Invalid product ID",
      });
    }

    const parsedQty = parsePositiveInteger(quantity);
    if (parsedQty === null) {
      return res.status(400).json({
        message: "Quantity must be a positive whole number",
      });
    }

    // 2. Verify product exists, is active, and has enough stock
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    if (!product.isActive) {
      return res.status(400).json({
        message: "This product is currently unavailable",
      });
    }

    if (parsedQty > product.stock) {
      return res.status(400).json({
        message: `Insufficient stock. Available stock: ${product.stock}`,
      });
    }

    // 3. Find the customer's cart and the item inside it
    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart || cart.items.length === 0) {
      return res.status(404).json({
        message: "Cart is empty",
      });
    }

    const itemToUpdate = cart.items.find(
      (item) => item.product.toString() === productId
    );

    if (!itemToUpdate) {
      return res.status(404).json({
        message: "Product not found in cart",
      });
    }

    itemToUpdate.quantity = parsedQty;
    await cart.save();
    await cart.populate(
      "items.product",
      "title price thumbnail stock isActive brand"
    );

    return res.status(200).json({
      message: "Cart item updated",
      cart: formatCartResponse(cart),
    });
  } catch (error) {
    console.error("Update cart item error:", error.message);
    return res.status(500).json({
      message: "Server error while updating cart item",
    });
  }
};

// @desc    Remove a specific product from the cart
// @route   DELETE /api/cart/:productId
// @access  Customer only
const removeCartItem = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        message: "Invalid product ID",
      });
    }

    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart || cart.items.length === 0) {
      return res.status(404).json({
        message: "Cart is empty",
      });
    }

    const itemExists = cart.items.some(
      (item) => item.product.toString() === productId
    );

    if (!itemExists) {
      return res.status(404).json({
        message: "Product not found in cart",
      });
    }

    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId
    );

    await cart.save();
    await cart.populate(
      "items.product",
      "title price thumbnail stock isActive brand"
    );

    return res.status(200).json({
      message: "Item removed from cart",
      cart: formatCartResponse(cart),
    });
  } catch (error) {
    console.error("Remove cart item error:", error.message);
    return res.status(500).json({
      message: "Server error while removing cart item",
    });
  }
};

// @desc    Clear all items from the logged-in customer's cart
// @route   DELETE /api/cart
// @access  Customer only
const clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart || cart.items.length === 0) {
      return res.status(200).json({
        message: "Cart is already empty",
        cart: formatCartResponse(null),
      });
    }

    cart.items = [];
    await cart.save();

    return res.status(200).json({
      message: "Cart cleared successfully",
      cart: formatCartResponse(cart),
    });
  } catch (error) {
    console.error("Clear cart error:", error.message);
    return res.status(500).json({
      message: "Server error while clearing cart",
    });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
};
