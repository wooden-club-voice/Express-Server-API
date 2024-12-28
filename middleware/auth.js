const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/user");
const redisClient = require("../utils/redisClient");

// IP 限流
const IPLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 每个IP 15分钟内只能注册5次
  message: "操作次数过多，请稍后再试",
});

// 生成 token
const generateToken = ({ tokenType = "ACCESS", id, boundIP }) => {
  const jwtOptions =
    tokenType === "ACCESS" ? { id, boundIP } : { id, jwtid: uuidv4() };

  return jwt.sign({ ...jwtOptions }, process.env[`${tokenType}_TOKEN_SECRET`], {
    expiresIn: process.env[`${tokenType}_TOKEN_EXPIRES_IN`],
  });
};

// 验证 token
const verifyToken = (tokenType = "ACCESS") => {
  return async (req, res, next) => {
    try {
      const token =
        req.headers["authorization"] &&
        req.headers["authorization"].split(" ")[1];

      if (!token) {
        throw new jwt.JsonWebTokenError("未提供 token");
      }

      const isBlacklisted = await redisClient.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new jwt.JsonWebTokenError("token 已失效");
      }

      const decoded = jwt.verify(
        token,
        process.env[`${tokenType}_TOKEN_SECRET`]
      );

      const user = await User.findById(decoded.id).select("-password");
      if (!user) {
        throw new Error("用户不存在");
      }

      // 将用户信息挂载到 req 对象，减少后续重复查询
      req.user = user;
      req.token = token;

      next();
    } catch (error) {
      switch (error.name) {
        case "TokenExpiredError":
          return res.status(401).json({
            message: "token 已过期",
          });
        case "JsonWebTokenError":
          return res.status(401).json({
            message: error.message,
          });
        case "NotBeforeError":
          return res.status(401).json({
            message: "token 尚未生效",
          });
        default:
          return res.status(500).json({
            message: error.message,
          });
      }
    }
  };
};

// 角色权限中间件（需要 token 验证中间件作为前置）
const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    const userRole = req.user.role;
    const userPermissions = req.user.permissions || [];

    // 超级管理员拥有所有权限
    if (userRole === "super_admin" || userPermissions.includes("*:*:*")) {
      return next();
    }

    // 检查具体权限
    if (!userPermissions.includes(requiredPermission)) {
      return res.status(403).json({
        message: "无权限执行此操作",
      });
    }

    next();
  };
};

module.exports = {
  IPLimiter,
  generateToken,
  verifyToken,
  checkPermission,
};
