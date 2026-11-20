const mongoose = require("mongoose");
const Category = require("../models/Category");
const Product = require("../models/Product");

// Helper to create a clean URL-friendly slug from category name
const makeSlug = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });

    return res.status(200).json({
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Get categories error:", error.message);
    return res.status(500).json({
      message: "Server error while fetching categories",
    });
  }
};

// @desc    Get a single category by ID
// @route   GET /api/categories/:id
// @access  Public
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid category ID",
      });
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    return res.status(200).json({ category });
  } catch (error) {
    console.error("Get category by ID error:", error.message);
    return res.status(500).json({
      message: "Server error while fetching category",
    });
  }
};

// @desc    Create a new category
// @route   POST /api/categories
// @access  Admin
const createCategory = async (req, res) => {
  try {
    const { name, slug, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Category name is required",
      });
    }

    const cleanName = name.trim();
    const cleanSlug = slug && slug.trim() ? makeSlug(slug) : makeSlug(cleanName);

    if (!cleanSlug) {
      return res.status(400).json({
        message: "A valid category slug is required",
      });
    }

    // Check for duplicate category name or slug
    const existing = await Category.findOne({
      $or: [
        { name: { $regex: `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
        { slug: cleanSlug },
      ],
    });

    if (existing) {
      return res.status(409).json({
        message: "A category with this name or slug already exists",
      });
    }

    const category = await Category.create({
      name: cleanName,
      slug: cleanSlug,
      description: description ? description.trim() : "",
    });

    return res.status(201).json({
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    console.error("Create category error:", error.message);
    return res.status(500).json({
      message: "Server error while creating category",
    });
  }
};

// @desc    Update a category
// @route   PUT /api/categories/:id
// @access  Admin
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid category ID",
      });
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    const { name, slug, description } = req.body;

    const updatedName =
      name !== undefined ? name.trim() : category.name;
    if (!updatedName) {
      return res.status(400).json({
        message: "Category name cannot be empty",
      });
    }

    const updatedSlug =
      slug !== undefined
        ? makeSlug(slug)
        : name !== undefined
          ? makeSlug(updatedName)
          : category.slug;

    if (!updatedSlug) {
      return res.status(400).json({
        message: "Category slug cannot be empty",
      });
    }

    // Prevent duplicate name or slug on another category
    const duplicate = await Category.findOne({
      _id: { $ne: id },
      $or: [
        { name: { $regex: `^${updatedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
        { slug: updatedSlug },
      ],
    });

    if (duplicate) {
      return res.status(409).json({
        message: "Another category with this name or slug already exists",
      });
    }

    category.name = updatedName;
    category.slug = updatedSlug;
    if (description !== undefined) {
      category.description = description.trim();
    }

    await category.save();

    return res.status(200).json({
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    console.error("Update category error:", error.message);
    return res.status(500).json({
      message: "Server error while updating category",
    });
  }
};

// @desc    Delete a category (blocked if products still reference it)
// @route   DELETE /api/categories/:id
// @access  Admin
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid category ID",
      });
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    // Do not allow deleting a category that still has associated products
    const associatedProductCount = await Product.countDocuments({
      category: id,
    });

    if (associatedProductCount > 0) {
      return res.status(400).json({
        message: `Cannot delete category because ${associatedProductCount} product(s) are still linked to it`,
      });
    }

    await category.deleteOne();

    return res.status(200).json({
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete category error:", error.message);
    return res.status(500).json({
      message: "Server error while deleting category",
    });
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
