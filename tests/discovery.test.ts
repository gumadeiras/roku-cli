import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseSsdpResponse, parseSsdpResponses } from "../src/discovery";

describe("discovery", () => {
  it("parses SSDP responses", () => {
    const response = Buffer.from(
      [
        "HTTP/1.1 200 OK",
        "CACHE-CONTROL: max-age=1800",
        "ST: roku:ecp",
        "USN: uuid:roku",
        "LOCATION: http://192.168.1.20:8060/",
        "",
        ""
      ].join("\r\n")
    );
    const parsed = parseSsdpResponse(response);
    assert.equal(parsed?.location, "http://192.168.1.20:8060/");
  });

  it("deduplicates responses", () => {
    const response = Buffer.from(
      [
        "HTTP/1.1 200 OK",
        "CACHE-CONTROL: max-age=1800",
        "ST: roku:ecp",
        "USN: uuid:roku",
        "LOCATION: http://192.168.1.20:8060/",
        "",
        ""
      ].join("\r\n")
    );
    const list = parseSsdpResponses([response, response]);
    assert.equal(list.length, 1);
  });
});
