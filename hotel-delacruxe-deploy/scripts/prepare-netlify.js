const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const files = ["index.html", "admin.html", "styles.css", "script.js", "admin.js"];

fs.rmSync(publicDir, { recursive: true, force: true });
fs.mkdirSync(publicDir, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(publicDir, file));
}

fs.cpSync(path.join(root, "assets"), path.join(publicDir, "assets"), { recursive: true });
