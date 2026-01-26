import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import fsSync from "node:fs";

export type AliasData = { devices: Record<string, string>; apps: Record<string, string> };

export function resolveHostInput(host?: string, alias?: string): string | undefined {
  if (host) {
    const aliases = loadAliasesSync();
    return aliases.devices[host] ?? host;
  }
  return resolveDeviceAlias(alias);
}

export function resolveDeviceAlias(alias?: string): string | undefined {
  if (!alias) return undefined;
  const aliases = loadAliasesSync();
  return aliases.devices[alias];
}

export function resolveAppAlias(value: string): string {
  const aliases = loadAliasesSync();
  return aliases.apps[value] ?? value;
}

export function parseHostInput(input: string): { host: string; port?: number } {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (trimmed.includes("://")) {
    const url = new URL(trimmed);
    return { host: url.hostname, port: url.port ? Number(url.port) : undefined };
  }
  const portMatch = trimmed.match(/^(.*):(\d+)$/);
  if (portMatch) {
    return { host: portMatch[1], port: Number(portMatch[2]) };
  }
  return { host: trimmed };
}

export function normalizeDeviceLocation(location: string): string {
  if (!location) return location;
  const parsed = parseHostInput(location);
  return parsed.port ? `${parsed.host}:${parsed.port}` : parsed.host;
}

export function isHostLike(value: string): boolean {
  if (!value) return false;
  if (value.includes("://")) return true;
  if (/^(?:\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(value)) return true;
  return value.includes(".") && !value.includes(" ");
}

export function isNumericAppId(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

export async function loadAliasData(): Promise<AliasData> {
  const file = aliasFilePath();
  try {
    const content = await fs.readFile(file, "utf-8");
    return normalizeAliasData(JSON.parse(content));
  } catch {
    return { devices: {}, apps: {} };
  }
}

export function loadAliasesSync(): AliasData {
  const file = aliasFilePath();
  try {
    const content = fsSync.readFileSync(file, "utf-8");
    return normalizeAliasData(JSON.parse(content));
  } catch {
    return { devices: {}, apps: {} };
  }
}

export async function saveAliasData(data: AliasData): Promise<void> {
  await fs.writeFile(aliasFilePath(), JSON.stringify(data, null, 2));
}

export async function saveDeviceAlias(alias: string, host: string): Promise<void> {
  const data = await loadAliasData();
  data.devices[alias] = host;
  await saveAliasData(data);
}

export async function removeAlias(alias: string): Promise<void> {
  const data = await loadAliasData();
  if (alias in data.devices) delete data.devices[alias];
  if (alias in data.apps) delete data.apps[alias];
  await saveAliasData(data);
}

export function normalizeAliasData(raw: unknown): AliasData {
  if (!raw || typeof raw !== "object") {
    return { devices: {}, apps: {} };
  }
  const data = raw as Record<string, any>;
  if (data.devices || data.apps) {
    return {
      devices: data.devices ?? {},
      apps: data.apps ?? {}
    };
  }
  return { devices: data as Record<string, string>, apps: {} };
}

export function aliasFilePath(): string {
  return path.join(os.homedir(), ".roku-cli.json");
}
