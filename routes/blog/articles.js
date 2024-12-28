const express = require("express");
const Article = require("../../models/article");
const Tag = require("../../models/tag");
const Category = require("../../models/category");
const { verifyToken } = require("../../middleware/auth");
const { validateParams } = require("../../middleware/validate");

const router = express.Router();

// 获取文章列表
router.get("/", verifyToken(), async (req, res, next) => {
  try {
    const {
      page = 1,
      pageSize = 10,
      order = "desc",
      tags, // 可选：标签ID数组
      category, // 可选：分类ID
    } = req.query;
    const query = {};

    if (tags) {
      query.tags = tags;
    }
    if (category) {
      query.category = category;
    }

    const sortOrderValue = order === "desc" ? -1 : 1;
    const total = await Article.countDocuments(query);
    const articles = await Article.find(query)
      .populate("tags", "name")
      .populate("category", "name")
      .skip((page - 1) * pageSize)
      .limit(Number(pageSize))
      .sort({ updatedAt: sortOrderValue });

    res.json({
      message: "获取文章列表成功",
      articles,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    res.status().json({ message: error.message });
  }
});

// 获取文章详情
router.get("/:id", verifyToken(), async (req, res, next) => {
  try {
    const { id } = req.params;

    const article = await Article.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } }, // 更新浏览量
      {
        new: true, // 返回更新后的文档
      }
    )
      .populate("author", "account profile")
      .populate("tags", "name")
      .populate("category", "name")
      .populate("comments");

    if (!article) {
      throw new Error("文章不存在");
    }

    res.json({ message: "获取文章详情成功", article });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 创建文章
router.post(
  "/",
  validateParams(["title", "content", "tags", "category"]),
  verifyToken(),
  async (req, res, next) => {
    try {
      const articleData = { ...req.body };
      articleData.author = req.user._id;

      const article = await Article.create(articleData);

      // 创建标签的文章引用
      await Promise.all(
        articleData.tags.map((TagId) => {
          return Tag.findByIdAndUpdate(TagId, {
            $addToSet: { articles: article._id },
          });
        })
      );

      // 创建分类的文章引用
      await Category.findByIdAndUpdate(articleData.category, {
        $addToSet: { articles: article._id },
      });

      res.json({ message: "创建文章成功" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// 修改文章
router.put("/:id", verifyToken(), async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const originalArticle = await Article.findById(id);
    if (!originalArticle) {
      throw new Error("文章不存在");
    }

    if (updateData.tags && updateData.tags.length === 0) {
      throw new Error("标签不能为空");
    }

    if (updateData.tags) {
      // 移除旧标签的文章引用
      await Promise.all(
        originalArticle.tags.map((oldTagId) => {
          return Tag.findByIdAndUpdate(oldTagId, {
            $pull: { articles: id },
          });
        })
      );
      // 添加新标签的文章引用
      await Promise.all(
        updateData.tags.map((newTagId) => {
          return Tag.findByIdAndUpdate(newTagId, {
            $addToSet: { articles: id },
          });
        })
      );
    }

    if (
      updateData.category &&
      updateData.category !== originalArticle.category
    ) {
      // 移除旧分类的文章引用
      if (originalArticle.category) {
        await Category.findByIdAndUpdate(originalArticle.category, {
          $pull: { articles: id },
        });
      }
      // 添加新分类的文章引用
      await Category.findByIdAndUpdate(updateData.category, {
        $addToSet: { articles: id },
      });
    }

    const updatedArticle = await Article.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    res.json({
      message: "更新文章成功",
      article: updatedArticle,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 删除文章
router.delete("/:id", verifyToken(), async (req, res, next) => {
  try {
    const { id } = req.params;
    const article = await Article.findByIdAndDelete(id);

    await Promise.all(
      article.tags.map((tagId) => {
        return Tag.findByIdAndUpdate(tagId, {
          $pull: { articles: id },
        });
      })
    );
    await Category.findByIdAndUpdate(article.category, {
      $pull: { articles: id },
    });

    res.json({ message: "删除文章成功" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
