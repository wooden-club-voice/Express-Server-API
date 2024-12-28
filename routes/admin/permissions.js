const express = require("express");
const User = require("../../models/user");
const { verifyToken, checkPermission } = require("../../middleware/auth");

const router = express.Router();

// 修改账号权限或身份
router.put(
  "/:userId",
  verifyToken(),
  checkPermission("permissions:update"),
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const {
        role, // 可选：修改角色
        addPermissions = [], // 要添加的权限
        removePermissions = [], // 要移除的权限
      } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        throw new Error("用户不存在");
      }

      // 更新角色身份
      if (role) {
        user.role = role;
      }

      // 添加权限
      addPermissions.forEach((permission) => {
        if (!user.permissions.includes(permission)) {
          user.permissions.push(permission);
        }
      });

      // 移除权限
      user.permissions = user.permissions.filter(
        (permission) => !removePermissions.includes(permission)
      );

      await user.save();

      res.json({
        message: "用户权限更新成功",
        user: {
          role: user.role,
          permissions: user.permissions,
        },
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
