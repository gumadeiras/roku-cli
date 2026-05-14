import assert from "node:assert/strict";
import { chmodSync, copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { spawnSync } from "node:child_process";

const sourceRoot = process.cwd();
const tempRepos: string[] = [];

function createReleaseRepo() {
  const repo = mkdtempSync(path.join(tmpdir(), "roku-cli-release-"));
  tempRepos.push(repo);

  mkdirSync(path.join(repo, "scripts"), { recursive: true });
  mkdirSync(path.join(repo, "dist", "release"), { recursive: true });
  mkdirSync(path.join(repo, "fake-bin"), { recursive: true });

  copyFileSync(path.join(sourceRoot, "scripts", "release"), path.join(repo, "scripts", "release"));
  copyFileSync(
    path.join(sourceRoot, "scripts", "sync-version.sh"),
    path.join(repo, "scripts", "sync-version.sh"),
  );
  chmodSync(path.join(repo, "scripts", "release"), 0o755);
  chmodSync(path.join(repo, "scripts", "sync-version.sh"), 0o755);

  writeFileSync(
    path.join(repo, "package.json"),
    `${JSON.stringify({ name: "@gumadeiras/roku", version: "1.1.3" }, null, 2)}\n`,
  );
  writeFileSync(
    path.join(repo, "package-lock.json"),
    `${JSON.stringify(
      {
        name: "@gumadeiras/roku",
        version: "1.1.3",
        lockfileVersion: 3,
        requires: true,
        packages: {
          "": {
            name: "@gumadeiras/roku",
            version: "1.1.3",
          },
        },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(path.join(repo, "dist", "release", "gumadeiras-roku-1.1.3.tgz"), "fake tgz\n");
  writeFileSync(
    path.join(repo, "fake-bin", "npm"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'printf "%s\\n" "$*" >> "$FAKE_NPM_LOG"',
      'if [[ "${1:-}" == "whoami" ]]; then',
      '  echo "fake-user"',
      "  exit 0",
      "fi",
      'if [[ "${1:-}" == "publish" ]]; then',
      "  exit 0",
      "fi",
      'echo "unexpected npm invocation: $*" >&2',
      "exit 1",
    ].join("\n") + "\n",
  );
  chmodSync(path.join(repo, "fake-bin", "npm"), 0o755);

  return repo;
}

function runRelease(repo: string, ...args: string[]) {
  const fakeNpmLog = path.join(repo, "fake-npm.log");
  return spawnSync("bash", [path.join(repo, "scripts", "release"), ...args], {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${path.join(repo, "fake-bin")}:${process.env.PATH ?? ""}`,
      FAKE_NPM_LOG: fakeNpmLog,
    },
  });
}

afterEach(() => {
  while (tempRepos.length > 0) {
    const repo = tempRepos.pop();
    if (repo) {
      rmSync(repo, { force: true, recursive: true });
    }
  }
});

describe("scripts/release", () => {
  it("rejects publish when the requested version does not match package metadata", () => {
    const repo = createReleaseRepo();
    const result = runRelease(repo, "publish", "9.9.9", "--dry-run");

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /expected '9\.9\.9'/);
    assert.equal(result.stdout, "");
  });

  it("publishes the tarball matching the requested version", () => {
    const repo = createReleaseRepo();
    const fakeNpmLog = path.join(repo, "fake-npm.log");
    const expectedTarball = path.join(repo, "dist", "release", "gumadeiras-roku-1.1.3.tgz");
    const result = runRelease(repo, "publish", "1.1.3", "--dry-run");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Dry-run publish completed for gumadeiras-roku-1\.1\.3\.tgz/);

    const npmCalls = readFileSync(fakeNpmLog, "utf8").trim().split("\n").filter(Boolean);
    assert.deepEqual(npmCalls, [
      "whoami",
      `publish ${expectedTarball} --access public --tag latest --dry-run`,
    ]);
  });
});
