#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const cliPath = path.join(__dirname, "..", "dist", "src", "cli.js");

if (!fs.existsSync(cliPath)) {
  execSync("npm run build", { stdio: "inherit", cwd: path.join(__dirname, "..") });
}

require(cliPath);
