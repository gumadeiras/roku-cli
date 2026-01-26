import dgram from "node:dgram";

export const ST_DIAL = "urn:dial-multiscreen-org:service:dial:1";
export const ST_ECP = "roku:ecp";

export type SSDPResponse = {
  location: string;
  usn: string;
  st: string;
  cache: string;
};

export function parseSsdpResponse(message: Buffer): SSDPResponse | null {
  const text = message.toString("utf-8");
  const lines = text.split("\r\n");
  if (!lines[0]?.includes("200")) {
    return null;
  }
  const headers: Record<string, string> = {};
  for (const line of lines.slice(1)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    headers[key] = value;
  }
  const cache = headers["cache-control"]?.split("=")[1] ?? "";
  if (!headers.location || !headers.usn || !headers.st) {
    return null;
  }
  return {
    location: headers.location,
    usn: headers.usn,
    st: headers.st,
    cache
  };
}

export function parseSsdpResponses(messages: Buffer[]): SSDPResponse[] {
  const responses = new Map<string, SSDPResponse>();
  for (const message of messages) {
    const parsed = parseSsdpResponse(message);
    if (parsed) {
      responses.set(parsed.location, parsed);
    }
  }
  return Array.from(responses.values());
}

export async function discover(options?: {
  timeoutMs?: number;
  retries?: number;
  st?: string;
}): Promise<SSDPResponse[]> {
  const timeoutMs = options?.timeoutMs ?? 2000;
  const retries = options?.retries ?? 1;
  const st = options?.st ?? ST_ECP;
  const group = { host: "239.255.255.250", port: 1900 };
  const message = [
    "M-SEARCH * HTTP/1.1",
    `HOST: ${group.host}:${group.port}`,
    'MAN: "ssdp:discover"',
    `ST: ${st}`,
    "MX: 3",
    "",
    ""
  ].join("\r\n");

  const responses = new Map<string, SSDPResponse>();

  for (let attempt = 0; attempt < retries; attempt += 1) {
    await new Promise<void>((resolve) => {
      const socket = dgram.createSocket("udp4");
      const timer = setTimeout(() => {
        socket.close();
        resolve();
      }, timeoutMs);

      socket.on("message", (msg) => {
        const parsed = parseSsdpResponse(msg);
        if (parsed) {
          responses.set(parsed.location, parsed);
        }
      });

      socket.on("error", () => {
        socket.close();
      });

      socket.send(message, group.port, group.host, () => {
        // no-op
      });

      socket.on("close", () => clearTimeout(timer));
    });
  }

  return Array.from(responses.values());
}
