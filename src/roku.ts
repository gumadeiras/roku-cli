import { URL } from "node:url";
import {
  KEY_COMMANDS,
  CommandName,
  SENSOR_TYPES,
  SensorName,
  TOUCH_ACTIONS,
  TouchOp
} from "./constants";
import {
  Application,
  Channel,
  DeviceInfo,
  MediaPlayer,
  RokuHttpError,
  RokuNetworkError,
  RokuValidationError
} from "./models";
import {
  deserializeApps,
  deserializeChannels,
  extractRootTag,
  extractSelfClosingTagAttrs,
  extractTagBlocks,
  extractTagText
} from "./xml";
import { discover as discoverDevices } from "./discovery";

export type RokuOptions = {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  logger?: Pick<Console, "debug" | "info" | "warn" | "error">;
};

export class Roku {
  readonly host: string;
  readonly port: number;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly retryDelayMs: number;
  private readonly logger?: Pick<Console, "debug" | "info" | "warn" | "error">;

  constructor(host: string, port = 8060, options?: RokuOptions) {
    this.host = host;
    this.port = port;
    this.timeoutMs = options?.timeoutMs ?? 10000;
    this.retries = options?.retries ?? 0;
    this.retryDelayMs = options?.retryDelayMs ?? 200;
    this.logger = options?.logger;

    for (const command of Object.keys(KEY_COMMANDS) as CommandName[]) {
      if (command === "search" || command === "literal") continue;
      (this as Record<string, unknown>)[command] = (arg?: "keydown" | "keyup") =>
        this.sendCommand(command, arg);
    }
    for (const sensor of SENSOR_TYPES) {
      (this as Record<string, unknown>)[sensor] = (x: number, y: number, z: number) =>
        this.sensorInput(sensor, x, y, z);
    }
  }

  static async discover(options?: {
    timeoutMs?: number;
    retries?: number;
    st?: string;
  }): Promise<Roku[]> {
    const devices = await discoverDevices(options);
    return devices.map((device) => {
      const url = new URL(device.location);
      return new Roku(url.hostname, Number(url.port) || 8060);
    });
  }

  get commands(): CommandName[] {
    return Object.keys(KEY_COMMANDS).sort() as CommandName[];
  }

  async getApps(): Promise<Application[]> {
    const resp = await this.get("/query/apps");
    const apps = deserializeApps(resp);
    for (const app of apps) {
      app.roku = this;
    }
    return apps;
  }

  async getActiveApp(): Promise<Application | null> {
    const resp = await this.get("/query/active-app");
    const apps = deserializeApps(resp);
    return apps.length ? apps[0] : null;
  }

  async getCurrentApp(): Promise<Application | null> {
    const resp = await this.get("/query/active-app");
    const xml = resp.toString("utf-8");
    const screensavers = extractTagBlocks(xml, "screensaver");
    const apps = extractTagBlocks(xml, "app");
    const block = screensavers[0] ?? apps[0];
    if (!block) return null;
    return new Application(
      block.attrs.id ?? "",
      block.attrs.version,
      block.text ?? "",
      this,
      Boolean(screensavers[0])
    );
  }

  async getTvChannels(): Promise<Channel[]> {
    const resp = await this.get("/query/tv-channels");
    const channels = deserializeChannels(resp);
    for (const channel of channels) {
      channel.roku = this;
    }
    return channels;
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    const resp = await this.get("/query/device-info");
    const xml = resp.toString("utf-8");
    const isTv = extractTagText(xml, "is-tv") === "true";
    const isStick = extractTagText(xml, "is-stick") === "true";
    const rokuType = isTv ? "TV" : isStick ? "Stick" : "Box";
    return new DeviceInfo({
      modelName: extractTagText(xml, "model-name") ?? "",
      modelNum: extractTagText(xml, "model-number") ?? "",
      softwareVersion: `${extractTagText(xml, "software-version") ?? ""}.${extractTagText(
        xml,
        "software-build"
      ) ?? ""}`,
      serialNum: extractTagText(xml, "serial-number") ?? "",
      userDeviceName: extractTagText(xml, "user-device-name") ?? "",
      rokuType
    });
  }

  async getMediaPlayer(): Promise<MediaPlayer> {
    const resp = await this.get("/query/media-player");
    const xml = resp.toString("utf-8");
    const root = extractRootTag(xml);
    if (!root) {
      throw new RokuValidationError("Invalid media player response");
    }
    const state = root.attrs.state ?? "";
    const pluginAttrs = extractSelfClosingTagAttrs(xml, "plugin");
    if (!pluginAttrs.id) {
      throw new RokuValidationError("Media player plugin id missing");
    }
    const appId = Number(pluginAttrs.id);
    const apps = await this.getApps();
    const app = apps.find((candidate) => Number(candidate.id) === appId);
    if (!app) {
      throw new RokuValidationError(`App ${pluginAttrs.id} not found`);
    }
    const position = Number(String(extractTagText(xml, "position") ?? "0").split(" ", 1)[0]);
    const duration = Number(String(extractTagText(xml, "duration") ?? "0").split(" ", 1)[0]);
    return new MediaPlayer({
      state,
      app,
      position,
      duration
    });
  }

  async getPowerState(): Promise<"On" | "Off" | "Unknown"> {
    const resp = await this.get("/query/device-info");
    const xml = resp.toString("utf-8");
    const powerMode = extractTagText(xml, "power-mode");
    if (!powerMode) return "Unknown";
    return powerMode === "PowerOn" ? "On" : "Off";
  }

  async icon(app: Application): Promise<Buffer> {
    return this.get(`/query/icon/${app.id}`);
  }

  iconUrl(app: Application): string {
    return `http://${this.host}:${this.port}/query/icon/${app.id}`;
  }

  async launch(app: Application, params: Record<string, string> = {}): Promise<void> {
    if (app.roku && app.roku !== this) {
      throw new RokuValidationError("this app belongs to another Roku");
    }
    params.contentID = app.id;
    await this.post(`/launch/${app.id}`, params);
  }

  async store(app: Application): Promise<void> {
    await this.post("/launch/11", { contentID: app.id });
  }

  async input(params: Record<string, string | number>): Promise<void> {
    await this.post("/input", params);
  }

  async touch(x: number, y: number, op: TouchOp = "down"): Promise<void> {
    if (!TOUCH_ACTIONS.includes(op)) {
      throw new RokuValidationError(`${op} is not a valid touch operation`);
    }
    await this.input({
      "touch.0.x": x,
      "touch.0.y": y,
      "touch.0.op": op
    });
  }

  async literal(text: string): Promise<void> {
    for (const char of text) {
      const encoded = encodeRokuParam(char);
      await this.post(`/keypress/${KEY_COMMANDS.literal}_${encoded}`);
    }
  }

  async search(params: Record<string, string>): Promise<void> {
    const mapped: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      mapped[key.replace(/_/g, "-")] = value;
    }
    await this.post("/search/browse", mapped);
  }

  async sendCommand(name: CommandName, state?: "keydown" | "keyup"): Promise<void> {
    if (name === "literal" || name === "search") {
      throw new RokuValidationError(`Use the ${name} method instead`);
    }
    const path =
      state === "keydown" || state === "keyup"
        ? `/${state}/${KEY_COMMANDS[name]}`
        : `/keypress/${KEY_COMMANDS[name]}`;
    await this.post(path);
  }

  async sensorInput(sensor: SensorName, x: number, y: number, z: number): Promise<void> {
    await this.input({
      [`${sensor}.x`]: x,
      [`${sensor}.y`]: y,
      [`${sensor}.z`]: z
    });
  }

  async getApp(key: string): Promise<Application | undefined> {
    const apps = await this.getApps();
    return apps.find((app) => app.id === key || app.name === key);
  }

  private async get(path: string): Promise<Buffer> {
    return this.call("GET", path);
  }

  private async post(path: string, params?: Record<string, string | number>): Promise<Buffer> {
    return this.call("POST", path, params);
  }

  private async call(
    method: "GET" | "POST",
    path: string,
    params?: Record<string, string | number>
  ): Promise<Buffer> {
    if (!path.startsWith("/")) {
      throw new RokuValidationError(`Invalid path ${path}`);
    }
    const url = `http://${this.host}:${this.port}${path}`;
    const body =
      method === "POST" && params
        ? new URLSearchParams(
            Object.entries(params).map(([k, v]) => [k, String(v)])
          ).toString()
        : undefined;

    let attempt = 0;
    while (true) {
      try {
        this.logger?.debug?.(`Roku ${method} ${path}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        const response = await fetch(url, {
          method,
          headers: body ? { "Content-Type": "application/x-www-form-urlencoded" } : undefined,
          body,
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (!response.ok) {
          const text = await response.text();
          throw new RokuHttpError(response.status, text);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch (error) {
        const normalized =
          error instanceof RokuHttpError
            ? error
            : error instanceof Error
              ? new RokuNetworkError(
                  error.name === "AbortError"
                    ? "Request timed out"
                    : error.message || "Network error"
                )
              : new RokuNetworkError("Network error");
        if (attempt >= this.retries) {
          throw normalized;
        }
        attempt += 1;
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
      }
    }
  }
}

function encodeRokuParam(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "+");
}
