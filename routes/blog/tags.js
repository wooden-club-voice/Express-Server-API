const express = require("express");
const Article = require("../../models/article");
const Tag = require("../../models/tag");
const { verifyToken } = require("../../middleware/auth");
const { validateParams } = require("../../middleware/validate");

const router = express.Router();

// 获取标签列表
router.get("/", verifyToken(), async (req, res, next) => {
  try {
    const tags = await Tag.find();

    res.json({ message: "获取标签列表成功", tags });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 创建标签
router.post(
  "/",
  validateParams(["name"]),
  verifyToken(),
  async (req, res, next) => {
    try {
      const { name } = req.body;
      await Tag.create({ name });

      res.json({ message: "创建标签成功" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// 删除标签，同时从所有文章中移除该标签
router.delete("/:id", verifyToken(), async (req, res, next) => {
  try {
    const { id } = req.params;

    const articles = await Article.find({ tags: id });
    const articlesWithOnlyThisTag = articles.filter(
      (article) =>
        article.tags.length === 1 && article.tags[0].toString() === id
    );

    if (articlesWithOnlyThisTag.length > 0) {
      return res.status(500).json({
        message: "存在文章仅使用此标签，无法删除",
        affectedArticles: articlesWithOnlyThisTag.length,
      });
    }

    await Article.updateMany({ tags: id }, { $pull: { tags: id } });
    await Tag.findByIdAndDelete(id);

    res.json({
      message: "删除标签成功",
      affectedArticles: articles.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
