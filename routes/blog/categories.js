const express = require("express");
const Article = require("../../models/article");
const Category = require("../../models/category");
const { verifyToken } = require("../../middleware/auth");
const { validateParams } = require("../../middleware/validate");

const router = express.Router();

// 获取分类列表
router.get("/", verifyToken(), async (req, res, next) => {
  try {
    const categories = await Category.find();

    res.json({ message: "获取分类列表成功", categories });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 创建分类
router.post(
  "/",
  validateParams(["name"]),
  verifyToken(),
  async (req, res, next) => {
    try {
      const { name } = req.body;
      await Category.create({ name });

      res.json({ message: "创建分类成功" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// 删除分类
router.delete("/:id", verifyToken(), async (req, res, next) => {
  try {
    const { id } = req.params;

    const articles = await Article.find({ category: id });
    if (articles.length > 0) {
      throw new Error("存在文章使用此分类，无法删除");
    }

    await Category.findByIdAndDelete(id);

    res.json({
      message: "删除分类成功",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 更新分类
router.put("/:id", verifyToken(), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    await Category.findByIdAndUpdate(id, { name });

    res.json({ message: "更新分类成功" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
module.exports = router;
