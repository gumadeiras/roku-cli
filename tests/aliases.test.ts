import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  loadAliasData,
  saveAliasData,
  normalizeAliasData,
  resolveAppAlias,
  resolveDeviceAlias
} from "../src/cli/aliases";

describe("aliases", () => {
  it("normalizes legacy data", () => {
    const data = normalizeAliasData({ livingroom: "192.168.1.10" });
    assert.equal(data.devices.livingroom, "192.168.1.10");
    assert.deepEqual(data.apps, {});
  });

  it("loads and resolves aliases", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "roku-cli-"));
    process.env.HOME = tmp;
    await saveAliasData({
      devices: { projector: "192.168.1.10:8060" },
      apps: { plex: "13535" }
    });
    const data = await loadAliasData();
    assert.equal(data.devices.projector, "192.168.1.10:8060");
    assert.equal(resolveDeviceAlias("projector"), "192.168.1.10:8060");
    assert.equal(resolveAppAlias("plex"), "13535");
  });
});
