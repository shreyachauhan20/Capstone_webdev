const User = require("../models/User");
const { verifyAccessToken } = require("../utils/tokenUtils");

// Middleware to protect routes by verifying the JWT access token
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Not authorized, access token is missing",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token);

    // Fetch user without exposing password hash or stored refresh token
    const user = await User.findById(decoded.id).select(
      "-password -refreshToken"
    );

    if (!user) {
      return res.status(401).json({
        message: "Not authorized, user no longer exists",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Access token has expired",
      });
    }

    return res.status(401).json({
      message: "Not authorized, invalid access token",
    });
  }
};

module.exports = { protect };
