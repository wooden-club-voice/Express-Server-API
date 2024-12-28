const { createClient } = require("redis");

class RedisClient {
  constructor() {
    this.isConnected = false;
    this.client = null;
    this.connect();
  }

  async connect() {
    try {
      this.client = createClient({
        url: process.env.REDIS_URL || "redis://localhost:6379",
      });

      this.client.on("error", (err) => {
        console.error("Redis Client Error", err);
        this.isConnected = false;
      });

      await this.client.connect();
      this.isConnected = true;
      console.log("Redis 连接成功");
    } catch (error) {
      console.error("Redis 初始化失败:", error);
      this.isConnected = false;
    }
  }

  async isTokenBlacklisted(token) {
    if (!this.isConnected) {
      console.warn("Redis 未连接，无法检查黑名单");
      return false;
    }

    try {
      const result = await this.client.get(`blacklist:${token}`);
      return result !== null;
    } catch (error) {
      console.error("检查黑名单失败:", error);
      return false;
    }
  }

  async blacklistToken(
    token,
    defaultExpires = process.env.BLACKLIST_TOKEN_EXPIRES_IN
  ) {
    if (!this.isConnected) {
      console.warn("Redis 未连接，无法加入黑名单");
      return false;
    }

    try {
      await this.client.set(`blacklist:${token}`, "true", {
        EX: this.parseExpiration(defaultExpires),
      });
      return true;
    } catch (error) {
      console.error("加入黑名单失败:", error);
      return false;
    }
  }

  // 解析过期时间
  parseExpiration(expires) {
    const units = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    const match = expires.match(/^(\d+)([smhd])$/);
    if (!match) {
      console.warn(`无效的过期时间格式: ${expires}. 默认使用 7 天`);
      return 7 * 86400;
    }

    const value = parseInt(match[1]);
    const unit = match[2];
    return value * units[unit];
  }

  // 关闭连接
  quit() {
    if (this.client) {
      this.client.quit();
    }
  }
}

module.exports = new RedisClient();
