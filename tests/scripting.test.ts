import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadScript, parseScript, runScript } from "../src/scripting";
import { Roku } from "../src/roku";

const scriptPath = path.join(process.cwd(), "tests", "fixtures", "testscript.txt");

describe("scripting", () => {
  it("loads script", async () => {
    const content = await loadScript(scriptPath);
    assert.equal(Array.isArray(content), true);
  });

  it("loads script params", async () => {
    const content = (await loadScript(scriptPath, { avar: "here" }, true)) as string;
    assert.ok(content.includes("literal:here"));
    assert.ok(!content.includes("literal:missing"));
  });

  it("parses commands", () => {
    const commands = parseScript(["literal:barbecue@3*5.1"]);
    assert.deepEqual(commands[0], {
      command: "literal",
      param: "barbecue",
      count: 3,
      sleep: 5.1
    });
  });

  it("runs scripts", async () => {
    const roku = new Roku("0.0.0.0");
    const calls: string[] = [];
    const originalHome = (roku as any).home;
    const originalLiteral = (roku as any).literal;
    (roku as any).home = async () => {
      calls.push("home");
    };
    (roku as any).literal = async () => {
      calls.push("literal");
    };
    const commands = parseScript(["home", "literal:x"]);
    await runScript(roku, commands, 0);
    assert.deepEqual(calls, ["home", "literal"]);
    (roku as any).home = originalHome;
    (roku as any).literal = originalLiteral;
  });
});
