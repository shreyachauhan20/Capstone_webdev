const jwt = require("jsonwebtoken");

// Helper to ensure required JWT secrets are configured in .env
const getSecrets = () => {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!accessSecret || !refreshSecret) {
    throw new Error(
      "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in environment variables"
    );
  }

  return { accessSecret, refreshSecret };
};

// Generate short-lived JWT access token (contains user id and role)
const generateAccessToken = (user) => {
  const { accessSecret } = getSecrets();

  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
    },
    accessSecret,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    }
  );
};

// Generate longer-lived JWT refresh token (contains user id)
const generateRefreshToken = (user) => {
  const { refreshSecret } = getSecrets();

  return jwt.sign(
    {
      id: user._id.toString(),
    },
    refreshSecret,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    }
  );
};

// Verify an incoming access token
const verifyAccessToken = (token) => {
  const { accessSecret } = getSecrets();
  return jwt.verify(token, accessSecret);
};

// Verify an incoming refresh token
const verifyRefreshToken = (token) => {
  const { refreshSecret } = getSecrets();
  return jwt.verify(token, refreshSecret);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
