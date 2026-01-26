import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { RokuServer } from "../src/server";
import { Emulator } from "../src/emulator";
import { Application } from "../src/models";

describe("RokuServer", () => {
  let server: RokuServer;
  let baseUrl: string;

  before(async () => {
    const emulator = new Emulator([new Application("1", "1.0", "App One")]);
    server = new RokuServer({ port: 0, emulator });
    await server.start();
    baseUrl = `http://127.0.0.1:${server.getPort()}`;
  });

  after(async () => {
    await server.stop();
  });

  it("serves apps", async () => {
    const resp = await fetch(`${baseUrl}/query/apps`);
    const text = await resp.text();
    assert.ok(text.includes("App One"));
  });

  it("serves active app", async () => {
    const resp = await fetch(`${baseUrl}/query/active-app`);
    const text = await resp.text();
    assert.ok(text.includes("<app"));
  });

  it("serves device info", async () => {
    const resp = await fetch(`${baseUrl}/query/device-info`);
    const text = await resp.text();
    assert.ok(text.includes("Emulated Roku"));
  });
});
