#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const rootPath = path.join(__dirname, "..");
const cliPath = path.join(__dirname, "..", "dist", "src", "cli.js");
const srcPath = path.join(rootPath, "src");
const tsconfigPath = path.join(rootPath, "tsconfig.json");

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
  const hasDevelopmentSources = fs.existsSync(srcPath) && fs.existsSync(tsconfigPath);
  if (!fs.existsSync(cliPath)) return hasDevelopmentSources;
  if (!hasDevelopmentSources) return false;
  const distStat = fs.statSync(cliPath);
  const newestSrc = newestMtime(srcPath);
  return newestSrc > distStat.mtimeMs;
}

if (shouldBuild()) {
  execSync("npm run build", { stdio: "inherit", cwd: rootPath });
}

if (!fs.existsSync(cliPath)) {
  process.stderr.write(`Missing built CLI entrypoint at ${cliPath}\n`);
  process.exit(1);
}

require(cliPath);
