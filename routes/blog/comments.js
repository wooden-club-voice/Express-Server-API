const express = require("express");
const Article = require("../../models/article");
const Comment = require("../../models/comment");
const { verifyToken } = require("../../middleware/auth");
const { validateParams } = require("../../middleware/validate");

const router = express.Router();

// 评论文章
router.post(
  "/:articleId",
  validateParams(["content"]),
  verifyToken(),
  async (req, res, next) => {
    try {
      const { articleId } = req.params;
      const { content } = req.body;
      const article = await Article.findById(articleId);

      const comment = await Comment.create({
        content,
        author: req.user._id,
        article: articleId,
      });
      article.comments.push(comment._id);
      await article.save();

      res.json({ message: "评论文章成功" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// 删除评论
router.delete("/:id/:articleId", verifyToken(), async (req, res, next) => {
  try {
    const { id, articleId } = req.params;
    const article = await Article.findById(articleId);

    await Comment.findByIdAndDelete(id);
    article.comments = article.comments.filter(
      (comment) => comment.toString() !== id
    );
    await article.save();

    res.json({ message: "删除评论成功" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
