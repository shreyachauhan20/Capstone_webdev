const mongoose = require("mongoose");
const Product = require("../models/Product");
const Category = require("../models/Category");

// Helper to escape special characters for safe regex search
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// @desc    Get all products with search, filtering, sorting, and pagination
// @route   GET /api/products
// @access  Public
const getAllProducts = async (req, res) => {
  try {
    const {
      search,
      q,
      category,
      minPrice,
      maxPrice,
      inStock,
      availability,
      sort,
      page,
      limit,
    } = req.query;

    const filter = { isActive: true };

    // 1. Search by title and description
    const keyword = (search || q || "").trim();
    if (keyword) {
      const safeKeyword = escapeRegex(keyword);
      filter.$or = [
        { title: { $regex: safeKeyword, $options: "i" } },
        { description: { $regex: safeKeyword, $options: "i" } },
      ];
    }

    // 2. Filter by category (accepts either Category ObjectId or category slug)
    if (category && category.trim()) {
      const categoryValue = category.trim();
      if (mongoose.Types.ObjectId.isValid(categoryValue)) {
        filter.category = categoryValue;
      } else {
        const foundCategory = await Category.findOne({
          slug: categoryValue.toLowerCase(),
        });
        if (!foundCategory) {
          // Valid query, but no matching category exists -> return empty page
          const pageNum = Math.max(1, parseInt(page, 10) || 1);
          const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 8));
          return res.status(200).json({
            products: [],
            total: 0,
            page: pageNum,
            limit: limitNum,
            totalPages: 0,
          });
        }
        filter.category = foundCategory._id;
      }
    }

    // 3. Filter by price range
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};

      if (minPrice !== undefined && minPrice !== "") {
        const min = Number(minPrice);
        if (Number.isNaN(min) || min < 0) {
          return res.status(400).json({
            message: "minPrice must be a valid non-negative number",
          });
        }
        filter.price.$gte = min;
      }

      if (maxPrice !== undefined && maxPrice !== "") {
        const max = Number(maxPrice);
        if (Number.isNaN(max) || max < 0) {
          return res.status(400).json({
            message: "maxPrice must be a valid non-negative number",
          });
        }
        filter.price.$lte = max;
      }
    }

    // 4. Filter by availability / stock
    if (inStock === "true" || availability === "inStock") {
      filter.stock = { $gt: 0 };
    } else if (inStock === "false" || availability === "outOfStock") {
      filter.stock = 0;
    }

    // 5. Sorting (price or creation date)
    let sortOption = { createdAt: -1 };
    if (sort === "price_asc" || sort === "low") {
      sortOption = { price: 1 };
    } else if (sort === "price_desc" || sort === "high") {
      sortOption = { price: -1 };
    } else if (sort === "oldest") {
      sortOption = { createdAt: 1 };
    } else if (sort === "newest") {
      sortOption = { createdAt: -1 };
    }

    // 6. Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 8));
    const skip = (pageNum - 1) * limitNum;

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .populate("category", "name slug")
      .populate("seller", "name")
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum);

    return res.status(200).json({
      products,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error("Get products error:", error.message);
    return res.status(500).json({
      message: "Server error while fetching products",
    });
  }
};

// @desc    Get a single product by ID
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid product ID",
      });
    }

    const product = await Product.findById(id)
      .populate("category", "name slug")
      .populate("seller", "name");

    if (!product || !product.isActive) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    return res.status(200).json({ product });
  } catch (error) {
    console.error("Get product by ID error:", error.message);
    return res.status(500).json({
      message: "Server error while fetching product",
    });
  }
};

// @desc    Create a new product
// @route   POST /api/products
// @access  Seller or Admin
const createProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      brand,
      thumbnail,
      stock,
      lowStockThreshold,
      category,
      isActive,
    } = req.body;

    // 1. Validate required text fields
    if (!title || !title.trim() || !description || !description.trim()) {
      return res.status(400).json({
        message: "Product title and description are required",
      });
    }

    // 2. Validate price
    if (price === undefined || price === null || price === "") {
      return res.status(400).json({
        message: "Product price is required",
      });
    }
    const parsedPrice = Number(price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({
        message: "Price must be a valid non-negative number",
      });
    }

    // 3. Validate stock
    const parsedStock = stock === undefined ? 0 : Number(stock);
    if (
      Number.isNaN(parsedStock) ||
      !Number.isInteger(parsedStock) ||
      parsedStock < 0
    ) {
      return res.status(400).json({
        message: "Stock must be a valid non-negative whole number",
      });
    }

    // 4. Validate lowStockThreshold if provided
    let parsedThreshold = 5;
    if (lowStockThreshold !== undefined) {
      parsedThreshold = Number(lowStockThreshold);
      if (
        Number.isNaN(parsedThreshold) ||
        !Number.isInteger(parsedThreshold) ||
        parsedThreshold < 0
      ) {
        return res.status(400).json({
          message: "Low stock threshold must be a valid non-negative whole number",
        });
      }
    }

    // 5. Validate category ObjectId and check that category exists
    if (!category || !mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({
        message: "A valid category ID is required",
      });
    }

    const existingCategory = await Category.findById(category);
    if (!existingCategory) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    // 6. Validate isActive boolean if provided
    if (isActive !== undefined && typeof isActive !== "boolean") {
      return res.status(400).json({
        message: "isActive must be a boolean value",
      });
    }

    // 7. Always set seller from authenticated user (never trust req.body.seller)
    const product = await Product.create({
      title: title.trim(),
      description: description.trim(),
      price: parsedPrice,
      brand: brand && brand.trim() ? brand.trim() : "Generic",
      thumbnail: thumbnail ? thumbnail.trim() : "",
      stock: parsedStock,
      lowStockThreshold: parsedThreshold,
      category: existingCategory._id,
      seller: req.user._id,
      isActive: isActive !== undefined ? isActive : true,
    });

    await product.populate("category", "name slug");
    await product.populate("seller", "name");

    return res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error("Create product error:", error.message);
    return res.status(500).json({
      message: "Server error while creating product",
    });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Owner Seller or Admin
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid product ID",
      });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    // Ownership check: sellers can only modify their own products; admins can modify any
    if (
      req.user.role !== "admin" &&
      product.seller.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "Forbidden: you can only update your own products",
      });
    }

    const {
      title,
      description,
      price,
      brand,
      thumbnail,
      stock,
      lowStockThreshold,
      category,
      isActive,
    } = req.body;

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({
          message: "Product title cannot be empty",
        });
      }
      product.title = title.trim();
    }

    if (description !== undefined) {
      if (!description.trim()) {
        return res.status(400).json({
          message: "Product description cannot be empty",
        });
      }
      product.description = description.trim();
    }

    if (price !== undefined) {
      const parsedPrice = Number(price);
      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({
          message: "Price must be a valid non-negative number",
        });
      }
      product.price = parsedPrice;
    }

    if (stock !== undefined) {
      const parsedStock = Number(stock);
      if (
        Number.isNaN(parsedStock) ||
        !Number.isInteger(parsedStock) ||
        parsedStock < 0
      ) {
        return res.status(400).json({
          message: "Stock must be a valid non-negative whole number",
        });
      }
      product.stock = parsedStock;
    }

    if (lowStockThreshold !== undefined) {
      const parsedThreshold = Number(lowStockThreshold);
      if (
        Number.isNaN(parsedThreshold) ||
        !Number.isInteger(parsedThreshold) ||
        parsedThreshold < 0
      ) {
        return res.status(400).json({
          message: "Low stock threshold must be a valid non-negative whole number",
        });
      }
      product.lowStockThreshold = parsedThreshold;
    }

    if (category !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({
          message: "Invalid category ID",
        });
      }
      const existingCategory = await Category.findById(category);
      if (!existingCategory) {
        return res.status(404).json({
          message: "Category not found",
        });
      }
      product.category = existingCategory._id;
    }

    if (brand !== undefined) {
      product.brand = brand.trim() || "Generic";
    }

    if (thumbnail !== undefined) {
      product.thumbnail = thumbnail.trim();
    }

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        return res.status(400).json({
          message: "isActive must be a boolean value",
        });
      }
      product.isActive = isActive;
    }

    await product.save();
    await product.populate("category", "name slug");
    await product.populate("seller", "name");

    return res.status(200).json({
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    console.error("Update product error:", error.message);
    return res.status(500).json({
      message: "Server error while updating product",
    });
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Owner Seller or Admin
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid product ID",
      });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    // Ownership check: sellers can only delete their own products; admins can delete any
    if (
      req.user.role !== "admin" &&
      product.seller.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "Forbidden: you can only delete your own products",
      });
    }

    await product.deleteOne();

    return res.status(200).json({
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error.message);
    return res.status(500).json({
      message: "Server error while deleting product",
    });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
