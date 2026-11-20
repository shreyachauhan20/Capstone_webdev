const { Server } = require("socket.io");
const User = require("../models/User");
const { verifyAccessToken } = require("../utils/tokenUtils");

let ioInstance = null;

// Initialize Socket.IO on top of the HTTP server with JWT authentication
const initSocket = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    },
  });

  // Authenticate every socket connection using the JWT access token
  ioInstance.use(async (socket, next) => {
    try {
      const authToken = socket.handshake.auth && socket.handshake.auth.token;
      const headerAuth =
        socket.handshake.headers && socket.handshake.headers.authorization;

      let token = authToken;
      if (!token && headerAuth && headerAuth.startsWith("Bearer ")) {
        token = headerAuth.split(" ")[1];
      }

      if (!token) {
        return next(new Error("Authentication error: access token missing"));
      }

      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id).select("_id name role");

      if (!user) {
        return next(new Error("Authentication error: user not found"));
      }

      socket.user = {
        id: user._id.toString(),
        name: user.name,
        role: user.role,
      };

      return next();
    } catch {
      return next(new Error("Authentication error: invalid or expired token"));
    }
  });

  ioInstance.on("connection", (socket) => {
    // Join a private room for this user so alerts only reach their intended recipient
    const userRoom = `user:${socket.user.id}`;
    socket.join(userRoom);

    console.log(
      `Socket connected: ${socket.user.name} (${socket.user.role}) joined ${userRoom}`
    );

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.user.name}`);
    });
  });

  return ioInstance;
};

// Emit an event only to a specific user's private room
const emitToUser = (userId, eventName, payload) => {
  if (!ioInstance || !userId) return;
  ioInstance.to(`user:${userId.toString()}`).emit(eventName, payload);
};

const getIO = () => ioInstance;

module.exports = {
  initSocket,
  emitToUser,
  getIO,
};
