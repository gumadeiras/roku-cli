import { Application, Channel } from "./models";

export function deserializeApps(xml: string | Buffer): Application[] {
  const content = typeof xml === "string" ? xml : xml.toString("utf-8");
  const apps = extractTagBlocks(content, "app");
  return apps.map((app) => new Application(app.attrs.id ?? "", app.attrs.version, app.text));
}

export function serializeApps(apps: Application[]): string {
  const appEntries = apps
    .map((app) => `<app id="${app.id}" version="${app.version ?? ""}">${escapeXml(app.name)}</app>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><apps>${appEntries}</apps>`;
}

export function deserializeChannels(xml: string | Buffer): Channel[] {
  const content = typeof xml === "string" ? xml : xml.toString("utf-8");
  const channels: Channel[] = [];
  const channelBlocks = extractTagBlocks(content, "channel");
  for (const block of channelBlocks) {
    const number = extractTagText(block.text, "number");
    const name = extractTagText(block.text, "name");
    channels.push(new Channel(number ?? "", name ?? ""));
  }
  return channels;
}

export function extractTagText(xml: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(xml);
  return match?.[1]?.trim();
}

export function extractSelfClosingTagAttrs(xml: string, tag: string): Record<string, string> {
  const match = new RegExp(`<${tag}\\b([^/>]*?)/>`, "i").exec(xml);
  if (!match) return {};
  return parseAttrs(match[1] ?? "");
}

export function extractRootTag(xml: string): { name: string; attrs: Record<string, string> } | null {
  const match = /<(?!\?)([A-Za-z0-9_-]+)\b([^>]*)>/.exec(xml);
  if (!match) return null;
  return { name: match[1], attrs: parseAttrs(match[2] ?? "") };
}

export function extractTagBlocks(
  xml: string,
  tag: string
): Array<{ attrs: Record<string, string>; text: string }> {
  const regex = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const blocks: Array<{ attrs: Record<string, string>; text: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml))) {
    blocks.push({ attrs: parseAttrs(match[1] ?? ""), text: match[2]?.trim() ?? "" });
  }
  return blocks;
}

function parseAttrs(input: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([A-Za-z0-9_-]+)=["']([^"']*)["']/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input))) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
