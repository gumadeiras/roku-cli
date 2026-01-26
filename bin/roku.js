#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const cliPath = path.join(__dirname, "..", "dist", "src", "cli.js");
const srcPath = path.join(__dirname, "..", "src");

function newestMtime(dirPath) {
  let newest = 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const child = newestMtime(fullPath);
      if (child > newest) newest = child;
    } else if (entry.isFile()) {
      const stat = fs.statSync(fullPath);
      if (stat.mtimeMs > newest) newest = stat.mtimeMs;
    }
  }
  return newest;
}

function shouldBuild() {
  if (!fs.existsSync(cliPath)) return true;
  const distStat = fs.statSync(cliPath);
  const newestSrc = newestMtime(srcPath);
  return newestSrc > distStat.mtimeMs;
}

if (shouldBuild()) {
  execSync("npm run build", { stdio: "inherit", cwd: path.join(__dirname, "..") });
}

require(cliPath);
