const fs = require("fs");
const path = require("path");

function loadRoutes(app, routesDir, prefix = "") {
  // 递归扫描路由目录
  function scanRoutes(directory, baseRoute = prefix) {
    fs.readdirSync(directory).forEach((file) => {
      const fullPath = path.join(directory, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // 如果是目录，递归扫描，并将目录名作为路由前缀
        scanRoutes(fullPath, `${baseRoute}/${file}`);
      } else if (file.endsWith(".js")) {
        // 如果是 JS 文件，注册为路由
        const routeName = path.basename(file, ".js");
        const routePath =
          routeName === "index"
            ? baseRoute || "/"
            : `${baseRoute}/${routeName}`;

        const route = require(fullPath);

        // 处理默认导出和具体路由
        if (typeof route === "function") {
          app.use(routePath, route);
        } else if (route.router) {
          // 对于 router 对象，使用 routePath 作为前缀
          app.use(routePath, route.router);
        }
      }
    });
  }

  // 开始扫描路由目录
  scanRoutes(routesDir);
}

module.exports = loadRoutes;
