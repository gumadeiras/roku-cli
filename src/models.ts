import type { Roku } from "./roku";

export class RokuError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RokuError";
  }
}

export class RokuHttpError extends RokuError {
  readonly status: number;
  readonly body?: string;

  constructor(status: number, body?: string) {
    super(`Roku request failed with status ${status}`);
    this.name = "RokuHttpError";
    this.status = status;
    this.body = body;
  }
}

export class RokuNetworkError extends RokuError {
  constructor(message: string) {
    super(message);
    this.name = "RokuNetworkError";
  }
}

export class RokuValidationError extends RokuError {
  constructor(message: string) {
    super(message);
    this.name = "RokuValidationError";
  }
}

export class Application {
  readonly id: string;
  readonly version?: string;
  readonly name: string;
  readonly isScreensaver: boolean;
  roku?: Roku;

  constructor(
    id: string,
    version: string | undefined,
    name: string,
    roku?: Roku,
    isScreensaver = false
  ) {
    this.id = String(id);
    this.version = version ?? undefined;
    this.name = name;
    this.isScreensaver = isScreensaver;
    this.roku = roku;
  }

  equals(other: Application): boolean {
    return this.id === other.id && this.version === other.version;
  }

  get icon(): Promise<Buffer | undefined> | undefined {
    if (!this.roku) return undefined;
    return this.roku.icon(this);
  }

  get iconUrl(): string | undefined {
    if (!this.roku) return undefined;
    return this.roku.iconUrl(this);
  }

  async launch(): Promise<void> {
    if (this.roku) {
      await this.roku.launch(this);
    }
  }

  async store(): Promise<void> {
    if (this.roku) {
      await this.roku.store(this);
    }
  }
}

export class Channel {
  readonly number: string;
  readonly name: string;
  roku?: Roku;

  constructor(number: string, name: string, roku?: Roku) {
    this.number = String(number);
    this.name = name;
    this.roku = roku;
  }

  equals(other: Channel): boolean {
    return this.number === other.number && this.name === other.name;
  }

  async launch(): Promise<void> {
    if (!this.roku) return;
    const tvApp = new Application("tvinput.dtv", undefined, "TV", this.roku);
    await this.roku.launch(tvApp, { ch: this.number });
  }
}

export class DeviceInfo {
  readonly modelName: string;
  readonly modelNum: string;
  readonly softwareVersion: string;
  readonly serialNum: string;
  readonly userDeviceName: string;
  readonly rokuType: "Box" | "TV" | "Stick";

  constructor(data: {
    modelName: string;
    modelNum: string;
    softwareVersion: string;
    serialNum: string;
    userDeviceName: string;
    rokuType: "Box" | "TV" | "Stick";
  }) {
    this.modelName = data.modelName;
    this.modelNum = data.modelNum;
    this.softwareVersion = data.softwareVersion;
    this.serialNum = data.serialNum;
    this.userDeviceName = data.userDeviceName;
    this.rokuType = data.rokuType;
  }
}

export class MediaPlayer {
  readonly state: string;
  readonly app: Application;
  readonly position: number;
  readonly duration: number;

  constructor(data: {
    state: string;
    app: Application;
    position: number;
    duration: number;
  }) {
    this.state = data.state;
    this.app = data.app;
    this.position = data.position;
    this.duration = data.duration;
  }
}
