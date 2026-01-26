import { Application } from "./models";
import { serializeApps } from "./xml";

export const DEFAULT_APPS = [
  new Application("1", "1.0", "Hulu Plus"),
  new Application("2", "2.0", "TWiT"),
  new Application("3", "3.0", "Whisky Media"),
  new Application("4", "4.0", "Netflix")
];

export class Emulator {
  private apps: Application[];
  private activeApp?: Application;
  private icons: Map<string, Buffer>;

  constructor(apps: Application[] = DEFAULT_APPS) {
    this.apps = apps;
    this.activeApp = apps[0];
    this.icons = new Map();
  }

  listApps(): Application[] {
    return [...this.apps];
  }

  listAppsXml(): string {
    return serializeApps(this.apps);
  }

  addApp(app: Application): void {
    this.apps.push(app);
  }

  setIcon(appId: string, icon: Buffer): void {
    this.icons.set(appId, icon);
  }

  getIcon(appId: string): Buffer {
    return this.icons.get(appId) ?? Buffer.from("");
  }

  launchApp(appId: string): void {
    const next = this.apps.find((app) => app.id === appId);
    if (next) {
      this.activeApp = next;
    }
  }

  getActiveApp(): Application | undefined {
    return this.activeApp;
  }
}
