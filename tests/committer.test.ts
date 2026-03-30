import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

const scriptPath = path.join(process.cwd(), "scripts", "committer");
const tempRepos: string[] = [];

function run(cwd: string, command: string, args: string[]) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
  }).trim();
}

function git(cwd: string, ...args: string[]) {
  return run(cwd, "git", args);
}

function createRepo() {
  const repo = mkdtempSync(path.join(tmpdir(), "roku-cli-committer-"));
  tempRepos.push(repo);

  git(repo, "init", "-q");
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test User");
  writeFileSync(path.join(repo, "seed.txt"), "seed\n");
  git(repo, "add", "seed.txt");
  git(repo, "commit", "-qm", "seed");

  return repo;
}

function writeRepoFile(repo: string, relativePath: string, contents: string) {
  const fullPath = path.join(repo, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, contents);
}

function commitWithHelper(repo: string, commitMessage: string, ...args: string[]) {
  return run(repo, "bash", [scriptPath, commitMessage, ...args]);
}

function committedPaths(repo: string) {
  const output = git(repo, "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD");
  return output.split("\n").filter(Boolean).sort();
}

afterEach(() => {
  while (tempRepos.length > 0) {
    const repo = tempRepos.pop();
    if (repo) {
      rmSync(repo, { force: true, recursive: true });
    }
  }
});

describe("scripts/committer", () => {
  it("accepts newline and whitespace-delimited path blobs", () => {
    const repo = createRepo();
    writeRepoFile(repo, "alpha.txt", "alpha\n");
    writeRepoFile(repo, "nested/file with spaces.txt", "beta\n");

    commitWithHelper(repo, "test: path parsing", "alpha.txt\nnested/file with spaces.txt");

    assert.deepEqual(committedPaths(repo), ["alpha.txt", "nested/file with spaces.txt"]);
  });

  it("stages only the selected paths", () => {
    const repo = createRepo();
    writeRepoFile(repo, "CHANGELOG.md", "initial\n");
    writeRepoFile(repo, "unrelated.ts", "export const ok = true;\n");
    git(repo, "add", "CHANGELOG.md", "unrelated.ts");
    git(repo, "commit", "-qm", "seed extra files");

    writeRepoFile(repo, "CHANGELOG.md", "release note\n");
    writeRepoFile(repo, "unrelated.ts", "dirty\n");

    commitWithHelper(repo, "docs: changelog", "CHANGELOG.md");

    assert.deepEqual(committedPaths(repo), ["CHANGELOG.md"]);
    assert.match(git(repo, "status", "--short"), /M unrelated\.ts/);
  });
});
