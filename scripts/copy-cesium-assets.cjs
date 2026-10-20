const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "node_modules", "cesium", "Build", "Cesium");
const destDir = path.join(root, "public", "cesium");

function main() {
  if (!fs.existsSync(srcDir)) {
    console.warn("[copy-cesium-assets] Skip: install dependencies first.");
    return;
  }
  fs.mkdirSync(path.dirname(destDir), { recursive: true });
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.cpSync(srcDir, destDir, { recursive: true });
  console.log("[copy-cesium-assets] Copied to public/cesium");
}

main();
