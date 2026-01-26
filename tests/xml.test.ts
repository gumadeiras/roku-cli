import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Application, Channel } from "../src/models";
import { deserializeApps, deserializeChannels, serializeApps } from "../src/xml";

describe("xml", () => {
  it("serializes apps", () => {
    const apps = [new Application("1", "1.0", "App One")];
    const xml = serializeApps(apps);
    assert.ok(xml.includes("<app"));
    assert.ok(xml.includes("App One"));
  });

  it("deserializes apps", () => {
    const xml = '<?xml version="1.0" encoding="UTF-8"?><apps><app id="1" version="1.0">App One</app></apps>';
    const apps = deserializeApps(xml);
    assert.ok(apps[0] instanceof Application);
    assert.equal(apps[0].id, "1");
  });

  it("deserializes channels", () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?><tv-channels><channel><number>5</number><name>FOX</name></channel></tv-channels>';
    const channels = deserializeChannels(xml);
    assert.ok(channels[0] instanceof Channel);
    assert.equal(channels[0].number, "5");
  });
});
