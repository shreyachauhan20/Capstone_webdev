// Middleware to restrict route access to specific user roles
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Not authorized, user not authenticated",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden: role '${req.user.role}' is not allowed to access this resource`,
      });
    }

    next();
  };
};

module.exports = { authorizeRoles };
