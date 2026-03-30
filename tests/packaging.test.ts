import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";

const { runPackDry, runReleaseCheck } = require(path.join(
  process.cwd(),
  "scripts",
  "release-check.js",
)) as {
  runPackDry(rootDir?: string): Array<{ files?: Array<{ path: string }> }>;
  runReleaseCheck(rootDir?: string): string[];
};

describe("release packaging", () => {
  it("keeps release checks green", () => {
    assert.deepEqual(runReleaseCheck(process.cwd()), []);
  });

  it("exports a working library entrypoint", () => {
    const pkg = require(path.join(process.cwd(), "package.json")) as {
      exports?: unknown;
      main: string;
      types: string;
    };

    assert.equal("exports" in pkg, false);
    assert.equal(typeof require(path.join(process.cwd(), pkg.main)).Roku, "function");
    assert.equal(typeof pkg.types, "string");
  });

  it("does not publish sources or tests", () => {
    const packedPaths = new Set(
      runPackDry(process.cwd())
        .flatMap((result) => (result.files ?? []).map((file) => file.path))
        .filter(Boolean),
    );

    assert.equal(packedPaths.has("src/index.ts"), false);
    assert.equal(packedPaths.has("tests/roku.test.ts"), false);
    assert.equal(packedPaths.has("dist/tests/roku.test.js"), false);
    assert.equal(packedPaths.has("dist/src/index.js"), true);
  });
});
