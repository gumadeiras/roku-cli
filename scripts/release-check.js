#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const EXPECTED_REPOSITORY_URL = "https://github.com/gumadeiras/roku-cli";
const REQUIRED_PACKED_PATHS = [
  "README.md",
  "bin/roku.js",
  "dist/src/cli.js",
  "dist/src/index.d.ts",
  "dist/src/index.js",
  "service/roku-bridge.plist",
  "service/roku-bridge.service",
];
const FORBIDDEN_PACKED_PREFIXES = [
  "src/",
  "tests/",
  "dist/tests/",
  "SKILL.md",
  "tsconfig.json",
];

function normalizeRepoUrl(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/^git\+/, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "");
}

function loadPackageJson(rootDir = process.cwd()) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
}

function resolveNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runNpm(rootDir, args) {
  return execFileSync(resolveNpmCommand(), args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function runPackDry(rootDir = process.cwd()) {
  const raw = runNpm(rootDir, ["pack", "--dry-run", "--json", "--ignore-scripts"]);
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("npm pack --dry-run returned no results");
  }
  return parsed;
}

function collectMetadataErrors(pkg) {
  const errors = [];
  const repositoryUrl = normalizeRepoUrl(
    typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url,
  );

  if (pkg.name !== "roku-ts-cli") {
    errors.push(`package.json name must be "roku-ts-cli"; found "${pkg.name ?? ""}".`);
  }
  if (!pkg.description?.trim()) {
    errors.push("package.json description must be non-empty.");
  }
  if (pkg.license !== "MIT") {
    errors.push(`package.json license must be "MIT"; found "${pkg.license ?? ""}".`);
  }
  if (repositoryUrl !== EXPECTED_REPOSITORY_URL) {
    errors.push(
      `package.json repository.url must resolve to ${EXPECTED_REPOSITORY_URL}; found ${repositoryUrl || "<missing>"}.`,
    );
  }
  if (pkg.main !== "dist/src/index.js") {
    errors.push(`package.json main must be "dist/src/index.js"; found "${pkg.main ?? ""}".`);
  }
  if (pkg.types !== "dist/src/index.d.ts") {
    errors.push(
      `package.json types must be "dist/src/index.d.ts"; found "${pkg.types ?? ""}".`,
    );
  }
  if (pkg.bin?.roku !== "bin/roku.js") {
    errors.push(`package.json bin.roku must be "bin/roku.js"; found "${pkg.bin?.roku ?? ""}".`);
  }
  if (!Array.isArray(pkg.files)) {
    errors.push("package.json files must be an array.");
  } else {
    for (const entry of [
      "bin/roku.js",
      "dist/src",
      "service/roku-bridge.plist",
      "service/roku-bridge.service",
      "README.md",
    ]) {
      if (!pkg.files.includes(entry)) {
        errors.push(`package.json files must include "${entry}".`);
      }
    }
  }

  return errors;
}

function collectFilesystemErrors(rootDir = process.cwd(), pkg = loadPackageJson(rootDir)) {
  const errors = [];

  for (const relativePath of [pkg.main, pkg.types, pkg.bin?.roku]) {
    if (!relativePath) {
      continue;
    }
    const absolutePath = path.join(rootDir, relativePath);
    if (!fs.existsSync(absolutePath)) {
      errors.push(`Missing release file: ${relativePath}`);
    }
  }

  return errors;
}

function collectPackErrors(results) {
  const packedPaths = new Set(
    results.flatMap((result) => (result.files ?? []).map((file) => file.path)).filter(Boolean),
  );
  const errors = [];

  for (const requiredPath of REQUIRED_PACKED_PATHS) {
    if (!packedPaths.has(requiredPath)) {
      errors.push(`npm pack is missing ${requiredPath}.`);
    }
  }

  for (const packedPath of packedPaths) {
    if (FORBIDDEN_PACKED_PREFIXES.some((prefix) => packedPath === prefix || packedPath.startsWith(prefix))) {
      errors.push(`npm pack must not include ${packedPath}.`);
    }
  }

  return errors;
}

function runReleaseCheck(rootDir = process.cwd()) {
  const pkg = loadPackageJson(rootDir);
  return [
    ...collectMetadataErrors(pkg),
    ...collectFilesystemErrors(rootDir, pkg),
    ...collectPackErrors(runPackDry(rootDir)),
  ];
}

if (require.main === module) {
  const errors = runReleaseCheck(process.cwd());
  if (errors.length > 0) {
    console.error("release-check failed:");
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log("release-check: package metadata and pack contents look OK.");
}

module.exports = {
  collectFilesystemErrors,
  collectMetadataErrors,
  collectPackErrors,
  runPackDry,
  runReleaseCheck,
};
