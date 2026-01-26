import http, { IncomingMessage, ServerResponse } from "node:http";
import dgram from "node:dgram";
import os from "node:os";
import { Emulator } from "./emulator";

export type RokuServerOptions = {
  port?: number;
  emulator?: Emulator;
  ssdp?: boolean;
};

export class RokuServer {
  private server?: http.Server;
  private emulator: Emulator;
  private port: number;
  private ssdpSocket?: dgram.Socket;
  private ssdpEnabled: boolean;

  constructor(options?: RokuServerOptions) {
    this.port = options?.port ?? 8060;
    this.emulator = options?.emulator ?? new Emulator();
    this.ssdpEnabled = options?.ssdp ?? true;
  }

  async start(): Promise<void> {
    if (this.server) return;
    this.server = http.createServer((req, res) => this.handle(req, res));
    await new Promise<void>((resolve) => {
      this.server?.listen(this.port, () => {
        const address = this.server?.address();
        if (address && typeof address === "object") {
          this.port = address.port;
        }
        resolve();
      });
    });
    if (this.ssdpEnabled) {
      this.startSsdp();
    }
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve) => {
      this.server?.close(() => resolve());
    });
    this.server = undefined;
    if (this.ssdpSocket) {
      this.ssdpSocket.close();
      this.ssdpSocket = undefined;
    }
  }

  getPort(): number {
    return this.port;
  }

  private startSsdp(): void {
    if (this.ssdpSocket) return;
    const socket = dgram.createSocket("udp4");
    this.ssdpSocket = socket;
    socket.on("error", () => {
      socket.close();
      this.ssdpSocket = undefined;
    });
    socket.on("message", (msg, rinfo) => {
      const text = msg.toString("utf-8");
      if (!text.startsWith("M-SEARCH")) return;
      if (!/ssdp:discover/i.test(text)) return;
      const location = `http://${getLocalAddress()}:${this.port}/`;
      const response = buildSsdpResponse(location);
      socket.send(response, rinfo.port, rinfo.address);
    });
    socket.bind(1900, () => {
      try {
        socket.addMembership("239.255.255.250");
      } catch {
        socket.close();
        this.ssdpSocket = undefined;
      }
    });
  }

  private handle(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const method = req.method ?? "GET";

    if (method === "GET" && url.pathname === "/query/apps") {
      res.writeHead(200, { "Content-Type": "application/xml" });
      res.end(this.emulator.listAppsXml());
      return;
    }

    if (method === "GET" && url.pathname === "/query/active-app") {
      res.writeHead(200, { "Content-Type": "application/xml" });
      const app = this.emulator.getActiveApp();
      if (!app) {
        res.end('<?xml version="1.0" encoding="UTF-8"?><active-app></active-app>');
        return;
      }
      res.end(
        `<?xml version="1.0" encoding="UTF-8"?><active-app><app id="${app.id}" version="${app.version ?? ""}">${app.name}</app></active-app>`
      );
      return;
    }

    if (method === "GET" && url.pathname.startsWith("/query/icon/")) {
      const appId = url.pathname.split("/").pop() ?? "";
      const icon = this.emulator.getIcon(appId);
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(icon);
      return;
    }

    if (method === "GET" && url.pathname === "/query/device-info") {
      res.writeHead(200, { "Content-Type": "application/xml" });
      res.end(
        [
          '<?xml version="1.0" encoding="UTF-8"?>',
          "<device-info>",
          "<model-name>Emulated Roku</model-name>",
          "<model-number>0000X</model-number>",
          "<software-version>1.0</software-version>",
          "<software-build>000</software-build>",
          "<serial-number>EMULATOR</serial-number>",
          "<user-device-name>Roku Emulator</user-device-name>",
          "<is-tv>false</is-tv>",
          "<is-stick>false</is-stick>",
          "<power-mode>PowerOn</power-mode>",
          "</device-info>"
        ].join("")
      );
      return;
    }

    if (method === "POST" && url.pathname.startsWith("/launch/")) {
      const appId = url.pathname.split("/").pop() ?? "";
      this.emulator.launchApp(appId);
      res.writeHead(200);
      res.end("");
      return;
    }

    if (method === "POST" && url.pathname.startsWith("/keypress/")) {
      res.writeHead(200);
      res.end("");
      return;
    }

    if (method === "POST" && url.pathname === "/input") {
      res.writeHead(200);
      res.end("");
      return;
    }

    res.writeHead(404);
    res.end("");
  }
}

export function buildSsdpResponse(location: string): string {
  return [
    "HTTP/1.1 200 OK",
    "CACHE-CONTROL: max-age=1800",
    "ST: roku:ecp",
    "USN: uuid:roku-cli",
    `LOCATION: ${location}`,
    "",
    ""
  ].join("\r\n");
}

function getLocalAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const iface of entries ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}
