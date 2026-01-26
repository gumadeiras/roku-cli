import http from "node:http";
import os from "node:os";
import path from "node:path";
import { existsSync, promises as fs, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { executeAction, RokuActionTarget } from "./actions";
import { resolveAppAlias } from "./aliases";

export type BridgeOptions = {
  port: number;
  host?: string;
  token?: string;
};

export type BridgeServer = {
  port: number;
  close: () => void;
};

export type BridgeServiceOptions = {
  host: string;
  port: number;
  token: string;
  listenHost?: string;
  userService?: boolean;
  binaryPath?: string;
  nodePath?: string;
};

export async function startCommandServer(
  roku: RokuActionTarget,
  options: BridgeOptions
): Promise<BridgeServer> {
  const stats = createBridgeStats();
  const queue = createQueue();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/health") {
      const deep = url.searchParams.get("deep") === "1";
      const started = Date.now();
      let ok = true;
      let error: string | undefined;
      let checked: "probe" | "client" | "skipped" = "skipped";
      if (deep) {
        try {
          await queue.run(async () => {
            const probe = await probeRoku(roku);
            checked = probe.checked;
          });
        } catch (err) {
          ok = false;
          error = (err as Error).message;
          checked = "probe";
        }
      }
      const latencyMs = Date.now() - started;
      res.writeHead(ok ? 200 : 503, { "Content-Type": "application/json" });
      res.end(`${JSON.stringify({ ok, deep, checked, latencyMs, error })}\n`);
      return;
    }

    if (req.method === "GET" && url.pathname === "/stats") {
      if (options.token && !hasValidToken(req, options.token)) {
        stats.record("stats", "denied");
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(`${JSON.stringify({ ok: false, error: "Unauthorized" })}\n`);
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(`${JSON.stringify({ ok: true, stats })}\n`);
      return;
    }

    if (options.token && !hasValidToken(req, options.token)) {
      stats.record(url.pathname, "denied");
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(`${JSON.stringify({ ok: false, error: "Unauthorized" })}\n`);
      return;
    }

    if (req.method !== "POST") {
      stats.record(url.pathname, "invalid_method");
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
        await queue.run(() => executeAction(roku, { type: "key", key }));
        stats.record("key", "ok", { key });
      } else if (url.pathname === "/text") {
        const text = String(payload?.text ?? "");
        if (!text) throw new Error("Missing text");
        await queue.run(() => executeAction(roku, { type: "text", text }));
        stats.record("text", "ok", { text });
      } else if (url.pathname === "/search") {
        const params = payload && typeof payload === "object" ? payload : {};
        await queue.run(() => executeAction(roku, { type: "search", params }));
        stats.record("search", "ok", { params });
      } else if (url.pathname === "/launch") {
        const appName = String(payload?.app ?? "");
        if (!appName) throw new Error("Missing app");
        await queue.run(() =>
          executeAction(roku, { type: "launch", appKey: resolveAppAlias(appName) })
        );
        stats.record("launch", "ok", { app: appName });
      } else {
        stats.record(url.pathname, "not_found");
        res.writeHead(404);
        res.end("");
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(`${JSON.stringify({ ok: true })}\n`);
    } catch (error) {
      stats.record(url.pathname, "error", { error: (error as Error).message });
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(`${JSON.stringify({ ok: false, error: (error as Error).message })}\n`);
    }
  });

  const listenHost = options.host ?? "127.0.0.1";
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, listenHost, resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : options.port;
  return {
    port,
    close: () => server.close()
  };
}

export async function installBridgeService(options: BridgeServiceOptions): Promise<string> {
  if (process.platform === "darwin") {
    const plistPath = launchdPlistPath();
    const content = buildLaunchdPlist({
      ...options,
      binaryPath: options.binaryPath ?? resolveRokuBinaryPath(),
      nodePath: options.nodePath ?? process.execPath
    });
    await fs.writeFile(plistPath, content);
    return plistPath;
  }
  if (process.platform === "linux") {
    const servicePath = systemdServicePath(options.userService);
    if (options.userService) {
      await fs.mkdir(path.dirname(servicePath), { recursive: true });
    }
    const content = buildSystemdService({
      ...options,
      binaryPath: options.binaryPath ?? resolveRokuBinaryPath(),
      nodePath: options.nodePath ?? process.execPath
    });
    await fs.writeFile(servicePath, content);
    return servicePath;
  }
  throw new Error(`Unsupported platform ${process.platform}`);
}

export function controlBridgeService(
  action: "start" | "stop" | "restart",
  userService?: boolean
): void {
  if (process.platform === "darwin") {
    const label = "com.rokutscli.bridge";
    const plistPath = launchdPlistPath();
    const domain = `gui/${process.getuid?.() ?? 0}`;
    if (action === "start" || action === "restart") {
      runCommandIgnoreFailure("launchctl", ["bootout", domain, plistPath]);
      runCommand("launchctl", ["bootstrap", domain, plistPath]);
      runCommand("launchctl", ["kickstart", "-k", `${domain}/${label}`]);
    } else {
      runCommandIgnoreFailure("launchctl", ["bootout", domain, plistPath]);
    }
    return;
  }
  if (process.platform === "linux") {
    const baseArgs = userService ? ["--user"] : [];
    if (action === "start" || action === "restart") {
      runCommand("systemctl", [...baseArgs, "daemon-reload"]);
      runCommand("systemctl", [...baseArgs, action, "roku-bridge.service"]);
      runCommand("systemctl", [...baseArgs, "enable", "roku-bridge.service"]);
    } else {
      runCommand("systemctl", [...baseArgs, "stop", "roku-bridge.service"]);
      runCommand("systemctl", [...baseArgs, "disable", "roku-bridge.service"]);
    }
    return;
  }
  throw new Error(`Unsupported platform ${process.platform}`);
}

export function bridgeServiceStatus(
  userService?: boolean
): {
  status: "running" | "stopped" | "missing";
  pid?: string;
  logs?: string[];
  startedAt?: string;
} {
  if (process.platform === "darwin") {
    const label = "com.rokutscli.bridge";
    const result = spawnSync("launchctl", ["list", label], { stdio: "pipe" });
    if (result.status === 0) {
      const output = result.stdout?.toString("utf-8") ?? "";
      const pidMatch = output.match(/\"PID\"\s*=\s*(\d+)/);
      return {
        status: "running",
        pid: pidMatch ? pidMatch[1] : undefined,
        logs: readLogTail(getLogPath(userService), 25),
        startedAt: undefined
      };
    }
    return {
      status: "stopped",
      logs: readLogTail(getLogPath(userService), 25),
      startedAt: undefined
    };
  }
  if (process.platform === "linux") {
    const args = userService ? ["--user"] : [];
    const result = spawnSync("systemctl", [...args, "is-active", "roku-bridge.service"], {
      stdio: "pipe"
    });
    if (result.status === 0) {
      const pid = spawnSync("systemctl", [...args, "show", "-p", "MainPID", "roku-bridge.service"], {
        stdio: "pipe"
      }).stdout?.toString("utf-8");
      const pidMatch = pid?.match(/MainPID=(\d+)/);
      const started = spawnSync(
        "systemctl",
        [...args, "show", "-p", "ActiveEnterTimestamp", "roku-bridge.service"],
        { stdio: "pipe" }
      ).stdout?.toString("utf-8");
      const startedMatch = started?.match(/ActiveEnterTimestamp=(.*)/);
      return {
        status: "running",
        pid: pidMatch ? pidMatch[1] : undefined,
        logs: readLogTail(getLogPath(userService), 25),
        startedAt: startedMatch ? startedMatch[1].trim() : undefined
      };
    }
    return {
      status: "stopped",
      logs: readLogTail(getLogPath(userService), 25),
      startedAt: undefined
    };
  }
  return { status: "missing", startedAt: undefined };
}

export async function uninstallBridgeService(userService?: boolean): Promise<void> {
  if (process.platform === "darwin") {
    const plistPath = launchdPlistPath();
    try {
      const domain = `gui/${process.getuid?.() ?? 0}`;
      runCommand("launchctl", ["bootout", domain, plistPath]);
    } catch {
      // ignore unload errors
    }
    await fs.rm(plistPath, { force: true });
    return;
  }
  if (process.platform === "linux") {
    const baseArgs = userService ? ["--user"] : [];
    try {
      runCommand("systemctl", [...baseArgs, "stop", "roku-bridge.service"]);
      runCommand("systemctl", [...baseArgs, "disable", "roku-bridge.service"]);
    } catch {
      // ignore stop errors
    }
    await fs.rm(systemdServicePath(userService), { force: true });
    return;
  }
  throw new Error(`Unsupported platform ${process.platform}`);
}

export async function probeBridgeHealth(
  port: number,
  token: string,
  listenHost: string
): Promise<{ ok: boolean; status?: number; latencyMs?: number; error?: string }> {
  const url = `http://${listenHost}:${port}/health`;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      return { ok: false, status: res.status, latencyMs };
    }
    return { ok: true, status: res.status, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - started;
    return { ok: false, latencyMs, error: (error as Error).message };
  }
}

export async function diagnoseBridgeService(userService?: boolean): Promise<string[]> {
  const lines: string[] = [];
  const uid = process.getuid?.() ?? 0;
  lines.push(`platform: ${process.platform}`);
  lines.push(`user: ${os.userInfo().username} (uid ${uid})`);
  lines.push(`node: ${process.execPath}`);
  const program = resolveRokuProgram({
    host: "0.0.0.0",
    port: 0,
    token: "redacted"
  });
  lines.push(`roku: ${resolveRokuBinaryPath()}`);
  lines.push(`program: ${program.program}`);
  if (program.args.length) {
    lines.push(`script: ${program.args[0]}`);
  }
  if (process.platform === "darwin") {
    const plistPath = launchdPlistPath();
    lines.push(`plist: ${plistPath}`);
    if (existsSync(plistPath)) {
      const raw = await fs.readFile(plistPath, "utf-8");
      lines.push("plist-content:");
      for (const line of redactToken(raw).split("\n")) {
        lines.push(`  ${line}`);
      }
    } else {
      lines.push("plist-missing");
    }
    const domain = `gui/${uid}`;
    const print = spawnSync("launchctl", ["print", `${domain}/com.rokutscli.bridge`], {
      stdio: "pipe"
    });
    if (print.stdout?.length) {
      lines.push("launchctl-print:");
      for (const line of redactToken(print.stdout.toString("utf-8")).split("\n")) {
        lines.push(`  ${line}`);
      }
    }
    const outPath = getLogPath(userService);
    const errPath = getErrorLogPath();
    const outLines = readLogTail(outPath, 25);
    const errLines = readLogTail(errPath, 25);
    if (outLines.length) {
      lines.push(`log-out: ${outPath}`);
      for (const line of outLines) lines.push(`  ${line}`);
    }
    if (errLines.length) {
      lines.push(`log-err: ${errPath}`);
      for (const line of errLines) lines.push(`  ${line}`);
    }
  }
  if (process.platform === "linux") {
    const servicePath = systemdServicePath(userService);
    lines.push(`service: ${servicePath}`);
    if (existsSync(servicePath)) {
      const raw = await fs.readFile(servicePath, "utf-8");
      lines.push("service-content:");
      for (const line of redactToken(raw).split("\n")) {
        lines.push(`  ${line}`);
      }
    } else {
      lines.push("service-missing");
    }
    const baseArgs = userService ? ["--user"] : [];
    const status = spawnSync("systemctl", [...baseArgs, "status", "roku-bridge.service"], {
      stdio: "pipe"
    });
    if (status.stdout?.length) {
      lines.push("systemctl-status:");
      for (const line of status.stdout.toString("utf-8").split("\n")) {
        lines.push(`  ${line}`);
      }
    }
    const logPath = getLogPath(userService);
    const logLines = readLogTail(logPath, 25);
    if (logLines.length) {
      lines.push(`log: ${logPath}`);
      for (const line of logLines) lines.push(`  ${line}`);
    }
  }
  return lines;
}

function runCommand(cmd: string, args: string[]): void {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed`);
  }
}

function runCommandIgnoreFailure(cmd: string, args: string[]): void {
  const result = spawnSync(cmd, args, { stdio: "ignore" });
  if (result.error) {
    return;
  }
}

function getLogPath(userService?: boolean): string {
  if (process.platform === "darwin") {
    return "/tmp/rokutscli-bridge.out.log";
  }
  if (userService) {
    return path.join(os.homedir(), ".local", "state", "rokutscli-bridge.log");
  }
  return "/var/log/rokutscli-bridge.log";
}

function getErrorLogPath(): string {
  if (process.platform === "darwin") {
    return "/tmp/rokutscli-bridge.err.log";
  }
  return getLogPath();
}

function buildLaunchdPlist(options: BridgeServiceOptions): string {
  const program = resolveRokuProgram(options);
  const nodeDir = path.dirname(options.nodePath ?? process.execPath);
  const envPath = [
    nodeDir,
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin"
  ].join(":");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">`,
    `<plist version="1.0">`,
    `  <dict>`,
    `    <key>Label</key>`,
    `    <string>com.rokutscli.bridge</string>`,
    `    <key>ProgramArguments</key>`,
    `    <array>`,
    `      <string>${program.program}</string>`,
    ...program.args.map((arg) => `      <string>${arg}</string>`),
    `      <string>--host</string>`,
    `      <string>${options.host}</string>`,
    `      <string>bridge</string>`,
    `      <string>--listen</string>`,
    `      <string>${options.port}</string>`,
    `      <string>--listen-host</string>`,
    `      <string>${options.listenHost ?? "127.0.0.1"}</string>`,
    `      <string>--token</string>`,
    `      <string>${options.token}</string>`,
    `    </array>`,
    `    <key>EnvironmentVariables</key>`,
    `    <dict>`,
    `      <key>PATH</key>`,
    `      <string>${envPath}</string>`,
    `    </dict>`,
    `    <key>RunAtLoad</key>`,
    `    <true/>`,
    `    <key>KeepAlive</key>`,
    `    <true/>`,
    `    <key>StandardOutPath</key>`,
    `    <string>/tmp/rokutscli-bridge.out.log</string>`,
    `    <key>StandardErrorPath</key>`,
    `    <string>/tmp/rokutscli-bridge.err.log</string>`,
    `  </dict>`,
    `</plist>`
  ].join("\n");
}

function buildSystemdService(options: BridgeServiceOptions): string {
  const program = resolveRokuProgram(options);
  const lines: string[] = [
    `[Unit]`,
    `Description=Roku TS CLI Bridge`,
    `After=network-online.target`,
    `Wants=network-online.target`,
    ``,
    `[Service]`
  ];
  const nodeDir = path.dirname(options.nodePath ?? process.execPath);
  const envPath = [
    nodeDir,
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin"
  ].join(":");
  lines.push(`Environment=PATH=${envPath}`);
  if (options.userService) {
    lines.push(`Environment=HOME=${os.homedir()}`);
  }
  const programPrefix = [program.program, ...program.args].join(" ");
  lines.push(
    `ExecStart=${programPrefix} --host ${options.host} bridge --listen ${options.port} --listen-host ${options.listenHost ?? "127.0.0.1"} --token ${options.token}`,
    `Restart=always`,
    `RestartSec=2`,
    options.userService
      ? `StandardOutput=append:${path.join(os.homedir(), ".local", "state", "rokutscli-bridge.log")}`
      : `StandardOutput=append:/var/log/rokutscli-bridge.log`,
    options.userService
      ? `StandardError=append:${path.join(os.homedir(), ".local", "state", "rokutscli-bridge.log")}`
      : `StandardError=append:/var/log/rokutscli-bridge.log`,
    ``,
    `[Install]`,
    `WantedBy=multi-user.target`
  );
  return lines.join("\n");
}

function resolveRokuBinaryPath(): string {
  const which = spawnSync("which", ["roku"], { stdio: "pipe" });
  const output = which.stdout?.toString("utf-8").trim();
  if (output) return output;
  const fallback = ["/opt/homebrew/bin/roku", "/usr/local/bin/roku"];
  for (const candidate of fallback) {
    if (existsSync(candidate)) return candidate;
  }
  return "/usr/local/bin/roku";
}

function resolveRokuProgram(options: BridgeServiceOptions): { program: string; args: string[] } {
  const binary = options.binaryPath ?? resolveRokuBinaryPath();
  const nodePath = options.nodePath ?? process.execPath;
  try {
    const real = realpathSync(binary);
    if (real.endsWith(".js")) {
      const root = path.dirname(path.dirname(real));
      const distCli = path.join(root, "dist", "src", "cli.js");
      const script = existsSync(distCli) ? distCli : real;
      return { program: nodePath, args: [script] };
    }
  } catch {
    // fall back to binary
  }
  return { program: binary, args: [] };
}

function redactToken(input: string): string {
  return input
    .replace(/(--token\s+)(\S+)/g, "$1***")
    .replace(/(<string>--token<\/string>\s*<string>)([^<]+)(<\/string>)/g, "$1***$3");
}

function launchdPlistPath(): string {
  return path.join(
    os.homedir(),
    "Library",
    "LaunchAgents",
    "com.rokutscli.bridge.plist"
  );
}

function systemdServicePath(userService?: boolean): string {
  if (userService) {
    return path.join(os.homedir(), ".config", "systemd", "user", "roku-bridge.service");
  }
  return "/etc/systemd/system/roku-bridge.service";
}

function readLogTail(filePath: string, lines: number): string[] {
  try {
    const content = spawnSync("tail", ["-n", String(lines), filePath], {
      stdio: "pipe"
    }).stdout?.toString("utf-8");
    if (!content) return [];
    return content.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

type BridgeEvent = {
  id: number;
  at: string;
  path: string;
  status: "ok" | "denied" | "error" | "not_found" | "invalid_method";
  detail?: Record<string, unknown>;
};

type BridgeStats = {
  events: BridgeEvent[];
  lastEvent?: BridgeEvent;
  total: number;
  record: (path: string, status: BridgeEvent["status"], detail?: Record<string, unknown>) => void;
};

type WorkQueue = {
  run: <T>(fn: () => Promise<T>) => Promise<T>;
};

function createQueue(): WorkQueue {
  let pending = Promise.resolve();
  return {
    run: async (fn) => {
      const next = pending.then(fn, fn);
      pending = next.then(
        () => undefined,
        () => undefined
      );
      return next;
    }
  };
}

function createBridgeStats(): BridgeStats {
  const stats: BridgeStats = {
    events: [],
    total: 0,
    record: (path, status, detail) => {
      const event: BridgeEvent = {
        id: stats.total + 1,
        at: new Date().toISOString(),
        path,
        status,
        detail
      };
      stats.total += 1;
      stats.lastEvent = event;
      stats.events.push(event);
      if (stats.events.length > 20) {
        stats.events.shift();
      }
    }
  };
  return stats;
}

async function probeRoku(
  roku: RokuActionTarget
): Promise<{ ok: boolean; checked: "probe" | "client" | "skipped" }> {
  const host = (roku as Record<string, any>).host;
  const port = (roku as Record<string, any>).port ?? 8060;
  if (host) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`http://${host}:${port}/query/device-info`, {
      method: "GET",
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return { ok: true, checked: "probe" };
  }

  const candidate = (roku as Record<string, any>).getDeviceInfo;
  if (typeof candidate === "function") {
    await candidate.call(roku);
    return { ok: true, checked: "client" };
  }

  return { ok: true, checked: "skipped" };
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
