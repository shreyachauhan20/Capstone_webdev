const bcrypt = require("bcrypt");
const User = require("../models/User");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = require("../utils/tokenUtils");

// Helper to build a safe user object without password or refreshToken
const formatUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

// @desc    Register a new customer or seller
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // 1. Validate required inputs
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email, and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    // 2. Enforce public registration role rules (only customer or seller allowed)
    const selectedRole = role ? role.toLowerCase().trim() : "customer";

    if (selectedRole === "admin") {
      return res.status(403).json({
        message: "Admin accounts cannot be registered publicly",
      });
    }

    if (!["customer", "seller"].includes(selectedRole)) {
      return res.status(400).json({
        message: "Invalid role. Allowed roles are 'customer' and 'seller'",
      });
    }

    // 3. Check for duplicate email
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }

    // 4. Hash password with bcrypt before saving
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 5. Create user and issue tokens
    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: selectedRole,
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    return res.status(201).json({
      message: "Registration successful",
      accessToken,
      refreshToken,
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error("Register error:", error.message);
    return res.status(500).json({
      message: "Server error during registration",
    });
  }
};

// @desc    Login user with email and password
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Compare plain password with stored bcrypt hash
    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Issue new access and refresh tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    return res.status(200).json({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({
      message: "Server error during login",
    });
  }
};

// @desc    Generate a new access token using a valid refresh token
// @route   POST /api/auth/refresh
// @access  Public (requires valid refresh token)
const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        message: "Refresh token is required",
      });
    }

    // Verify JWT signature and expiry
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          message: "Refresh token has expired, please login again",
        });
      }
      return res.status(401).json({
        message: "Invalid refresh token",
      });
    }

    // Ensure the refresh token matches the one currently stored for this user
    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        message: "Refresh token has been invalidated or revoked",
      });
    }

    const newAccessToken = generateAccessToken(user);

    return res.status(200).json({
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error("Refresh token error:", error.message);
    return res.status(500).json({
      message: "Server error while refreshing token",
    });
  }
};

// @desc    Logout user and invalidate their stored refresh token
// @route   POST /api/auth/logout
// @access  Protected (Bearer access token or refreshToken in body)
const logout = async (req, res) => {
  try {
    let userId = null;
    const authHeader = req.headers.authorization;
    const suppliedRefreshToken =
      req.body && req.body.refreshToken ? req.body.refreshToken : null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        const decoded = verifyAccessToken(token);
        userId = decoded.id;
      } catch {
        return res.status(401).json({
          message: "Not authorized, invalid access token",
        });
      }
    } else if (suppliedRefreshToken) {
      try {
        const decoded = verifyRefreshToken(suppliedRefreshToken);
        userId = decoded.id;
      } catch {
        return res.status(401).json({
          message: "Not authorized, invalid refresh token",
        });
      }
    } else {
      return res.status(401).json({
        message: "Not authorized, provide an access token or refresh token",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    // If a refresh token was supplied in the body, ensure it matches the active stored token
    if (
      suppliedRefreshToken &&
      (!user.refreshToken || user.refreshToken !== suppliedRefreshToken)
    ) {
      return res.status(401).json({
        message: "Refresh token does not match active session",
      });
    }

    // Clear stored refresh token so it can no longer be used
    user.refreshToken = null;
    await user.save();

    return res.status(200).json({
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error.message);
    return res.status(500).json({
      message: "Server error during logout",
    });
  }
};

// @desc    Get currently logged-in user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  return res.status(200).json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      createdAt: req.user.createdAt,
    },
  });
};

module.exports = {
  register,
  login,
  refreshAccessToken,
  logout,
  getMe,
};
