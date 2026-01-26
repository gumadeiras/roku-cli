import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Emulator } from "../src/emulator";
import { Application } from "../src/models";

describe("Emulator", () => {
  it("lists and launches apps", () => {
    const emulator = new Emulator([new Application("1", "1.0", "App One")]);
    assert.equal(emulator.listApps().length, 1);
    emulator.launchApp("1");
    assert.equal(emulator.getActiveApp()?.id, "1");
  });

  it("stores icons", () => {
    const emulator = new Emulator();
    const icon = Buffer.from("icon");
    emulator.setIcon("1", icon);
    assert.equal(emulator.getIcon("1").toString("utf-8"), "icon");
  });
});
