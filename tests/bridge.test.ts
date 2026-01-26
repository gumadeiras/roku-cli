import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { startCommandServer } from "../src/cli/bridge";
import { saveAliasData } from "../src/cli/aliases";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const makeRoku = () => {
  const calls: Array<{ type: string; value?: string }> = [];
  const roku = {
    async literal(text: string) {
      calls.push({ type: "text", value: text });
    },
    async search(params: Record<string, string>) {
      calls.push({ type: "search", value: JSON.stringify(params) });
    },
    async getApp(key: string) {
      if (key === "plex") return { id: "1", name: "Plex" };
      return undefined;
    },
    async launch() {
      calls.push({ type: "launch" });
    },
    async home() {
      calls.push({ type: "key", value: "home" });
    }
  };
  return { roku, calls };
};

describe("bridge", () => {
  it("handles key, text, search, and launch", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "roku-cli-"));
    process.env.HOME = tmp;
    await saveAliasData({ devices: {}, apps: {} });
    const { roku, calls } = makeRoku();
    const server = await startCommandServer(roku, { port: 0 });
    const base = `http://127.0.0.1:${server.port}`;

    await fetch(`${base}/key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "home" })
    });
    await fetch(`${base}/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hello" })
    });
    await fetch(`${base}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Stargate" })
    });
    await fetch(`${base}/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app: "plex" })
    });

    server.close();
    assert.equal(calls.length, 4);
    assert.equal(calls[0].value, "home");
    assert.equal(calls[1].value, "hello");
    assert.ok(calls[2].value?.includes("Stargate"));
    assert.equal(calls[3].type, "launch");
  });

  it("rejects unauthorized requests when token is set", async () => {
    const { roku } = makeRoku();
    const server = await startCommandServer(roku, { port: 0, token: "secret" });
    const base = `http://127.0.0.1:${server.port}`;

    const resp = await fetch(`${base}/key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "home" })
    });

    server.close();
    assert.equal(resp.status, 401);
  });
});
