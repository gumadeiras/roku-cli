import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { RokuServer } from "../src/server";
import { RokuProxy } from "../src/proxy";

describe("RokuProxy", () => {
  let server: RokuServer;
  let proxy: RokuProxy;
  let proxyUrl: string;

  before(async () => {
    server = new RokuServer({ port: 0 });
    await server.start();
    proxy = new RokuProxy({
      remoteHost: "127.0.0.1",
      remotePort: server.getPort(),
      localPort: 0
    });
    await proxy.start();
    proxyUrl = `http://127.0.0.1:${proxy.getPort()}`;
  });

  after(async () => {
    await proxy.stop();
    await server.stop();
  });

  it("forwards requests", async () => {
    const resp = await fetch(`${proxyUrl}/query/device-info`);
    const text = await resp.text();
    assert.ok(text.includes("Emulated Roku"));
  });
});
