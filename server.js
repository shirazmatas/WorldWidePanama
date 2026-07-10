const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const port = process.env.PORT || 3000;
const root = __dirname;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function send(res, statusCode, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(statusCode, { "Content-Type": contentType });
    res.end(data);
  });
}

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const safePath = urlPath === "/" ? "/index.html" : urlPath;
    const filePath = path.normalize(path.join(root, safePath));

    if (!filePath.startsWith(root)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (!err && stats.isFile()) {
        send(res, 200, filePath);
        return;
      }

      const indexPath = path.join(root, "index.html");
      send(res, 200, indexPath);
    });
  })
  .listen(port, () => {
    console.log(`Static site running at http://localhost:${port}`);
  });
