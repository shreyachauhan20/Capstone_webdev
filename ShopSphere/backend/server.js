const http = require("http");
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const { initSocket } = require("./config/socket");

// Route imports
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

// Load environment variables from .env file
dotenv.config();

const app = express();
const httpServer = http.createServer(app);

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
  })
); // Allow requests from the React frontend
app.use(express.json()); // Parse incoming JSON request bodies

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/notifications", notificationRoutes);

// Health check route
app.get("/api/health", (req, res) => {
  const dbStates = {
    0: "Disconnected",
    1: "Connected",
    2: "Connecting",
    3: "Disconnecting",
  };

  const dbStatus = dbStates[mongoose.connection.readyState] || "Unknown";

  res.status(200).json({
    status: "OK",
    message: "ShopSphere backend server is running",
    database: dbStatus,
  });
});

// Initialize Socket.IO with JWT authentication
initSocket(httpServer);

// Start the HTTP + Socket.IO server only after MongoDB connection succeeds
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch {
    console.error("Server failed to start because MongoDB connection failed.");
    process.exit(1);
  }
};

startServer();
