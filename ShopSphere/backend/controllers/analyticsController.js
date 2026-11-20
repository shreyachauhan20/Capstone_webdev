const Order = require("../models/Order");
const Product = require("../models/Product");

// @desc    Sales report aggregation (total revenue, total orders, and sales by date)
// @route   GET /api/analytics/sales
// @access  Seller (own product sales) or Admin (storewide sales)
const getSalesReport = async (req, res) => {
  try {
    const isSeller = req.user.role === "seller";

    if (isSeller) {
      // For sellers, compute revenue & order count only from their own order items
      const [summaryResult, salesByDate] = await Promise.all([
        Order.aggregate([
          { $match: { status: { $ne: "cancelled" } } },
          { $unwind: "$items" },
          { $match: { "items.seller": req.user._id } },
          {
            $group: {
              _id: "$_id",
              sellerOrderRevenue: {
                $sum: { $multiply: ["$items.price", "$items.quantity"] },
              },
              unitsSold: { $sum: "$items.quantity" },
            },
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: "$sellerOrderRevenue" },
              totalOrders: { $sum: 1 },
              totalUnitsSold: { $sum: "$unitsSold" },
            },
          },
        ]),
        Order.aggregate([
          { $match: { status: { $ne: "cancelled" } } },
          { $unwind: "$items" },
          { $match: { "items.seller": req.user._id } },
          {
            $group: {
              _id: {
                date: {
                  $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                },
                orderId: "$_id",
              },
              revenue: {
                $sum: { $multiply: ["$items.price", "$items.quantity"] },
              },
            },
          },
          {
            $group: {
              _id: "$_id.date",
              revenue: { $sum: "$revenue" },
              orders: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
          {
            $project: {
              _id: 0,
              date: "$_id",
              revenue: { $round: ["$revenue", 2] },
              orders: 1,
            },
          },
        ]),
      ]);

      const summary = summaryResult[0] || {
        totalRevenue: 0,
        totalOrders: 0,
        totalUnitsSold: 0,
      };

      return res.status(200).json({
        scope: "seller",
        totalRevenue: Number((summary.totalRevenue || 0).toFixed(2)),
        totalOrders: summary.totalOrders || 0,
        totalUnitsSold: summary.totalUnitsSold || 0,
        salesByDate,
      });
    }

    // Admin sees storewide sales report
    const [summaryResult, salesByDate] = await Promise.all([
      Order.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
            totalOrders: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            revenue: { $sum: "$totalAmount" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            date: "$_id",
            revenue: { $round: ["$revenue", 2] },
            orders: 1,
          },
        },
      ]),
    ]);

    const summary = summaryResult[0] || {
      totalRevenue: 0,
      totalOrders: 0,
    };

    return res.status(200).json({
      scope: "admin",
      totalRevenue: Number((summary.totalRevenue || 0).toFixed(2)),
      totalOrders: summary.totalOrders || 0,
      salesByDate,
    });
  } catch (error) {
    console.error("Sales report aggregation error:", error.message);
    return res.status(500).json({
      message: "Server error while generating sales report",
    });
  }
};

// @desc    Best-selling products aggregation (product name, units sold, revenue)
// @route   GET /api/analytics/best-sellers
// @access  Seller (own products) or Admin (all products)
const getBestSellingProducts = async (req, res) => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 5));

    const pipeline = [
      { $match: { status: { $ne: "cancelled" } } },
      { $unwind: "$items" },
    ];

    if (req.user.role === "seller") {
      pipeline.push({ $match: { "items.seller": req.user._id } });
    }

    pipeline.push(
      {
        $group: {
          _id: "$items.product",
          productName: { $first: "$items.title" },
          unitsSold: { $sum: "$items.quantity" },
          revenueGenerated: {
            $sum: { $multiply: ["$items.price", "$items.quantity"] },
          },
        },
      },
      { $sort: { unitsSold: -1, revenueGenerated: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          productName: 1,
          unitsSold: 1,
          revenueGenerated: { $round: ["$revenueGenerated", 2] },
        },
      }
    );

    const bestSellers = await Order.aggregate(pipeline);

    return res.status(200).json({
      count: bestSellers.length,
      bestSellers,
    });
  } catch (error) {
    console.error("Best sellers aggregation error:", error.message);
    return res.status(500).json({
      message: "Server error while generating best-sellers report",
    });
  }
};

// @desc    Inventory summary aggregation (overall totals + per-category breakdown)
// @route   GET /api/analytics/inventory-summary
// @access  Seller (own inventory) or Admin (all inventory)
const getInventorySummary = async (req, res) => {
  try {
    const matchStage =
      req.user.role === "seller" ? [{ $match: { seller: req.user._id } }] : [];

    const [overallResult, byCategory] = await Promise.all([
      Product.aggregate([
        ...matchStage,
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            totalUnitsInStock: { $sum: "$stock" },
            totalInventoryValue: {
              $sum: { $multiply: ["$price", "$stock"] },
            },
            outOfStockCount: {
              $sum: { $cond: [{ $eq: ["$stock", 0] }, 1, 0] },
            },
            lowStockCount: {
              $sum: {
                $cond: [{ $lte: ["$stock", "$lowStockThreshold"] }, 1, 0],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalProducts: 1,
            totalUnitsInStock: 1,
            totalInventoryValue: { $round: ["$totalInventoryValue", 2] },
            outOfStockCount: 1,
            lowStockCount: 1,
          },
        },
      ]),
      Product.aggregate([
        ...matchStage,
        {
          $group: {
            _id: "$category",
            productCount: { $sum: 1 },
            totalUnits: { $sum: "$stock" },
            inventoryValue: { $sum: { $multiply: ["$price", "$stock"] } },
          },
        },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "_id",
            as: "categoryInfo",
          },
        },
        {
          $unwind: {
            path: "$categoryInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 0,
            categoryId: "$_id",
            categoryName: {
              $ifNull: ["$categoryInfo.name", "Uncategorized"],
            },
            productCount: 1,
            totalUnits: 1,
            inventoryValue: { $round: ["$inventoryValue", 2] },
          },
        },
        { $sort: { productCount: -1 } },
      ]),
    ]);

    const summary = overallResult[0] || {
      totalProducts: 0,
      totalUnitsInStock: 0,
      totalInventoryValue: 0,
      outOfStockCount: 0,
      lowStockCount: 0,
    };

    return res.status(200).json({
      summary,
      byCategory,
    });
  } catch (error) {
    console.error("Inventory summary aggregation error:", error.message);
    return res.status(500).json({
      message: "Server error while generating inventory summary",
    });
  }
};

module.exports = {
  getSalesReport,
  getBestSellingProducts,
  getInventorySummary,
};
