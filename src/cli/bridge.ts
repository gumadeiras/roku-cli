import http from "node:http";
import { executeAction, RokuActionTarget } from "./actions";
import { resolveAppAlias } from "./aliases";

export type BridgeOptions = {
  port: number;
  token?: string;
};

export type BridgeServer = {
  port: number;
  close: () => void;
};

export async function startCommandServer(
  roku: RokuActionTarget,
  options: BridgeOptions
): Promise<BridgeServer> {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (options.token && !hasValidToken(req, options.token)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405);
      res.end("");
      return;
    }

    const body = await readRequestBody(req);
    const payload = parseJson(body);

    try {
      if (url.pathname === "/key") {
        const key = String(payload?.key ?? payload?.command ?? "");
        if (!key) throw new Error("Missing key");
        await executeAction(roku, { type: "key", key });
      } else if (url.pathname === "/text") {
        const text = String(payload?.text ?? "");
        if (!text) throw new Error("Missing text");
        await executeAction(roku, { type: "text", text });
      } else if (url.pathname === "/search") {
        const params = payload && typeof payload === "object" ? payload : {};
        await executeAction(roku, { type: "search", params });
      } else if (url.pathname === "/launch") {
        const appName = String(payload?.app ?? "");
        if (!appName) throw new Error("Missing app");
        await executeAction(roku, { type: "launch", appKey: resolveAppAlias(appName) });
      } else {
        res.writeHead(404);
        res.end("");
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (error) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: (error as Error).message }));
    }
  });

  await new Promise<void>((resolve) => server.listen(options.port, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : options.port;
  return {
    port,
    close: () => server.close()
  };
}

function hasValidToken(req: http.IncomingMessage, token: string): boolean {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length) === token;
  }
  const alt = req.headers["x-roku-token"];
  if (typeof alt === "string") return alt === token;
  return false;
}

function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function parseJson(input: string): Record<string, any> | null {
  if (!input) return null;
  try {
    return JSON.parse(input) as Record<string, any>;
  } catch {
    return null;
  }
}
