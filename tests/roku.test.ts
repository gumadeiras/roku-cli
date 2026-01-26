import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Roku } from "../src/roku";
import { KEY_COMMANDS } from "../src/constants";
import { Application } from "../src/models";
import fs from "node:fs/promises";
import path from "node:path";

const fixturesPath = path.join(process.cwd(), "tests", "fixtures");

function responseFrom(data: string | Buffer, status = 200): Response {
  const body = typeof data === "string" ? data : new Uint8Array(data);
  return new Response(body, { status });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  calls = [];
});

describe("Roku", () => {
  it("lists apps and supports lookup", async () => {
    const appsXml =
      '<?xml version="1.0" encoding="UTF-8"?><apps><app id="0x" version="1.2.3">Sample Channel Store</app></apps>';
    setFetch(async () => responseFrom(appsXml));

    const roku = new Roku("0.0.0.0");
    const apps = await roku.getApps();
    assert.equal(apps.length, 1);
    assert.equal(apps[0].id, "0x");
    assert.equal(apps[0].name, "Sample Channel Store");

    const app = await roku.getApp("0x");
    assert.equal(app?.id, "0x");
  });

  it("parses device info", async () => {
    const xmlPath = path.join(fixturesPath, "device-info.xml");
    const content = await fs.readFile(xmlPath, "utf-8");
    setFetch(async () => responseFrom(content));

    const roku = new Roku("0.0.0.0");
    const info = await roku.getDeviceInfo();
    assert.equal(info.modelName, "Roku 3");
    assert.equal(info.modelNum, "4200X");
    assert.equal(info.softwareVersion, "7.00.09044");
    assert.equal(info.serialNum, "111111111111");
    assert.equal(info.rokuType, "Stick");
  });

  it("parses media player", async () => {
    const xmlPath = path.join(fixturesPath, "media-player.xml");
    const content = await fs.readFile(xmlPath, "utf-8");

    const appsXml =
      '<?xml version="1.0" encoding="UTF-8"?><apps><app id="33" version="1.2.3">Sample YouTube</app></apps>';

    setFetch(async (url) => {
      if (url.includes("/query/media-player")) return responseFrom(content);
      if (url.includes("/query/apps")) return responseFrom(appsXml);
      return responseFrom("");
    });

    const roku = new Roku("0.0.0.0");
    const media = await roku.getMediaPlayer();
    assert.equal(media.state, "pause");
    assert.equal(media.app.name, "Sample YouTube");
    assert.equal(media.position, 11187);
    assert.equal(media.duration, 1858000);
  });

  it("sends commands", async () => {
    setFetch(async (_url, _init) => responseFrom(""));

    const roku = new Roku("0.0.0.0");
    for (const cmd of roku.commands) {
      if (cmd === "literal" || cmd === "search") continue;
      await (roku as any)[cmd]();
      const last = calls[calls.length - 1];
      assert.ok(last.url.includes(`/keypress/${KEY_COMMANDS[cmd]}`));
      assert.equal(last.method, "POST");
    }
  });

  it("sends literal characters", async () => {
    setFetch(async (_url) => responseFrom(""));
    const roku = new Roku("0.0.0.0");
    const text = "Stargate";
    await roku.literal(text);
    for (let i = 0; i < text.length; i += 1) {
      assert.ok(calls[i].url.includes(`/keypress/Lit_${encodeURIComponent(text[i])}`));
    }
  });

  it("sends search parameters", async () => {
    setFetch(async (_url, _init) => responseFrom(""));
    const roku = new Roku("0.0.0.0");
    await roku.search({ title: "Stargate" });
    const last = calls[calls.length - 1];
    assert.ok(last.url.includes("/search/browse"));
    assert.ok(String(last.body ?? "").includes("title=Stargate"));
  });

  it("launches and stores apps", async () => {
    setFetch(async (_url, _init) => responseFrom(""));
    const roku = new Roku("0.0.0.0");
    const app = new Application("22", "2.0.2", "Sample Netflix", roku);
    await roku.launch(app);
    await roku.store(app);
    assert.ok(calls[0].url.includes("/launch/22"));
    assert.ok(String(calls[0].body ?? "").includes("contentID=22"));
    assert.ok(calls[1].url.includes("/launch/11"));
  });

  it("builds icon URL", () => {
    const roku = new Roku("0.0.0.0");
    const app = new Application("11", "1.0.1", "Sample Channel Store", roku);
    assert.equal(roku.iconUrl(app), "http://0.0.0.0:8060/query/icon/11");
  });

  it("parses current app and power state", async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?><active-app><app id="1" version="1.0">App One</app></active-app>';
    const deviceInfo =
      '<?xml version="1.0" encoding="UTF-8"?><device-info><power-mode>PowerOn</power-mode></device-info>';
    setFetch(async (url) => {
      if (url.includes("/query/active-app")) return responseFrom(xml);
      if (url.includes("/query/device-info")) return responseFrom(deviceInfo);
      return responseFrom("");
    });
    const roku = new Roku("0.0.0.0");
    const current = await roku.getCurrentApp();
    assert.equal(current?.name, "App One");
    const power = await roku.getPowerState();
    assert.equal(power, "On");
  });

  it("sends touch and sensor input", async () => {
    setFetch(async (_url, _init) => responseFrom(""));
    const roku = new Roku("0.0.0.0");
    await roku.touch(10, 20, "press");
    await (roku as any).acceleration(1, 2, 3);
    assert.ok(String(calls[0].body ?? "").includes("touch.0.x=10"));
    assert.ok(String(calls[1].body ?? "").includes("acceleration.x=1"));
  });

  it("rejects invalid touch op", async () => {
    setFetch(async () => responseFrom(""));
    const roku = new Roku("0.0.0.0");
    await assert.rejects(() => roku.touch(1, 2, "invalid" as any));
  });
});

const originalFetch = globalThis.fetch;
let calls: Array<{ url: string; method?: string; body?: BodyInit | null }> = [];

function setFetch(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  globalThis.fetch = async (url: any, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method, body: init?.body ?? null });
    return handler(String(url), init);
  };
}
