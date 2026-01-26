import http, { IncomingMessage, ServerResponse } from "node:http";

export type ProxyOptions = {
  remoteHost: string;
  remotePort?: number;
  localPort?: number;
  logger?: Pick<Console, "debug" | "info" | "warn" | "error">;
};

export class RokuProxy {
  private server?: http.Server;
  private readonly remoteHost: string;
  private readonly remotePort: number;
  private localPort: number;
  private readonly logger?: Pick<Console, "debug" | "info" | "warn" | "error">;

  constructor(options: ProxyOptions) {
    this.remoteHost = options.remoteHost;
    this.remotePort = options.remotePort ?? 8060;
    this.localPort = options.localPort ?? 8060;
    this.logger = options.logger;
  }

  async start(): Promise<void> {
    if (this.server) return;
    this.server = http.createServer((req, res) => this.forward(req, res));
    await new Promise<void>((resolve) => {
      this.server?.listen(this.localPort, () => {
        const address = this.server?.address();
        if (address && typeof address === "object") {
          this.localPort = address.port;
        }
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve) => {
      this.server?.close(() => resolve());
    });
    this.server = undefined;
  }

  getPort(): number {
    return this.localPort;
  }

  private forward(req: IncomingMessage, res: ServerResponse): void {
    const method = req.method ?? "GET";
    const url = req.url ?? "/";
    this.logger?.debug?.(`Proxy ${method} ${url}`);

    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const proxyReq = http.request(
        {
          hostname: this.remoteHost,
          port: this.remotePort,
          path: url,
          method,
          headers: req.headers
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode ?? 500, proxyRes.headers);
          proxyRes.pipe(res);
        }
      );
      proxyReq.on("error", () => {
        res.writeHead(502);
        res.end("");
      });
      if (body.length > 0) {
        proxyReq.write(body);
      }
      proxyReq.end();
    });
  }
}
