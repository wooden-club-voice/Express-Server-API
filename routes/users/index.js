const express = require("express");
const User = require("../../models/user");
const {
  verifyToken,
  generateToken,
  IPLimiter,
} = require("../../middleware/auth");
const { validateParams } = require("../../middleware/validate");
const redisClient = require("../../utils/redisClient");

const router = express.Router();

// 游客登录和注册
router.post(
  "/visitor-login",
  IPLimiter,
  validateParams(["account", "password"]),
  async (req, res, next) => {
    try {
      const { account, password, nickname } = req.body;
      const authHeader = req.headers["authorization"];
      const user = await User.findOne({ account });
      let newUser;

      if (user) {
        if (user.role !== "visitor") {
          return res
            .status(403)
            .json({ message: "账号权限不适合访问当前接口" });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
          throw new Error("密码错误");
        }

        if (user.status === "suspended") {
          throw new Error("账号已被禁用");
        }

        newUser = user;
        newUser.lastActiveAt = new Date();
        await newUser.save();
      } else {
        newUser = new User({
          account,
          password,
          profile: { nickname },
        });
        await newUser.save();
      }

      if (authHeader) {
        const existingToken = authHeader.split(" ")[1];
        // 将现有的 token 加入黑名单
        await redisClient.blacklistToken(existingToken);
      }

      const access_token = generateToken({
        tokenType: "ACCESS",
        id: newUser._id,
        boundIP: req.ip,
      });
      const refresh_token = generateToken({
        tokenType: "REFRESH",
        id: newUser._id,
      });

      res.status(200).json({
        message: "游客登录成功",
        access_token,
        refresh_token,
        user: {
          id: newUser._id,
          account: newUser.account,
          role: newUser.role,
          profile: newUser.profile,
        },
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// 登录（非游客登录）
router.post(
  "/login",
  validateParams(["account", "password"]),
  async (req, res, next) => {
    try {
      const { account, password } = req.body;
      const authHeader = req.headers["authorization"];
      const user = await User.findOne({ account });

      if (!user || user.role === "visitor") {
        throw new Error("用户不存在或者权限不适合访问");
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        throw new Error("密码错误");
      }

      if (user.status === "suspended") {
        throw new Error("账号已被禁用");
      }

      user.lastActiveAt = new Date();
      await user.save();

      if (authHeader) {
        const existingToken = authHeader.split(" ")[1];
        // 将现有的 token 加入黑名单
        await redisClient.blacklistToken(existingToken);
      }

      const access_token = generateToken({
        tokenType: "ACCESS",
        id: user._id,
        boundIP: req.ip,
      });
      const refresh_token = generateToken({
        tokenType: "REFRESH",
        id: user._id,
      });

      res.status(200).json({
        message: "登录成功",
        access_token,
        refresh_token,
        user: {
          id: user._id,
          account: user.account,
          role: user.role,
          profile: user.profile,
        },
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// 退出登录
router.post("/logout", verifyToken(), async (req, res, next) => {
  try {
    await redisClient.blacklistToken(req.token);

    res.status(200).json({ message: "退出登录成功" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 注册（非游客注册）
router.post(
  "/register",
  IPLimiter,
  validateParams(["account", "password"]),
  async (req, res, next) => {
    try {
      const { account, password, role = "member" } = req.body;
      const existingUser = await User.findOne({ account });

      if (existingUser) {
        throw new Error("账号已被注册");
      }

      const user = new User({ account, password, role });
      await user.save();

      const access_token = generateToken({
        tokenType: "ACCESS",
        id: user._id,
        boundIP: req.ip,
      });
      const refresh_token = generateToken({
        tokenType: "REFRESH",
        id: user._id,
      });

      res
        .status(200)
        .json({ message: "注册成功", access_token, refresh_token });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// 修改个人信息
router.put("/profile", verifyToken(), async (req, res, next) => {
  try {
    const profile = req.body;
    const user = await User.findById(req.user._id);

    user.profile = { ...user.profile, ...profile };
    await user.save();

    res.status(200).json({
      message: "账号信息修改成功",
      user: {
        id: user._id,
        account: user.account,
        role: user.role,
        profile: user.profile,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 修改密码
router.put(
  "/password",
  validateParams(["password"]),
  verifyToken(),
  async (req, res, next) => {
    try {
      const { password } = req.body;
      await User.updateOne({ _id: req.user._id }, { password });

      await redisClient.blacklistToken(req.token);

      res.status(200).json({ message: "密码修改成功" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// 搜索用户
router.get(
  "/search",
  validateParams(["keyword"]),
  verifyToken(),
  async (req, res, next) => {
    try {
      const { keyword } = req.query;
      const users = await User.find({
        $or: [
          { account: { $regex: keyword, $options: "i" } },
          { "profile.nickname": { $regex: keyword, $options: "i" } },
        ],
      }).select("_id account role profile");

      res.status(200).json({ message: "搜索成功", users });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// 刷新 token
router.get("/refresh-token", verifyToken("REFRESH"), async (req, res, next) => {
  try {
    const access_token = generateToken({
      tokenType: "ACCESS",
      id: req.user._id,
      boundIP: req.ip,
    });

    res.status(200).json({ message: "刷新成功", access_token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
