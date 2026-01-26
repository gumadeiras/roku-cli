import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSsdpResponse } from "../src/server";

describe("ssdp responder", () => {
  it("builds response with location", () => {
    const location = "http://127.0.0.1:8060/";
    const response = buildSsdpResponse(location);
    assert.ok(response.includes("HTTP/1.1 200 OK"));
    assert.ok(response.includes("ST: roku:ecp"));
    assert.ok(response.includes(`LOCATION: ${location}`));
  });
});
