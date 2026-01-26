import fs from "node:fs/promises";
import { Roku } from "./roku";
import { RokuValidationError } from "./models";

const SCRIPT_RE =
  /(?<command>\w+)(?::(?<param>[\w\s]+))?(?:@(?<count>\d+))?(?:\*(?<sleep>[\d.]+))?/;

export type ScriptCommand = {
  command: string;
  param?: string;
  count: number;
  sleep?: number;
};

export async function loadScript(
  path: string,
  params?: Record<string, string>,
  raw = false
): Promise<string[] | string> {
  let content: string;
  try {
    content = await fs.readFile(path, "utf-8");
  } catch {
    throw new RokuValidationError(`script at ${path} not found`);
  }
  if (params) {
    content = content.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`);
  }
  if (raw) return content;
  return content.trim().split("\n");
}

export function parseScript(lines: Iterable<string>): ScriptCommand[] {
  const commands: ScriptCommand[] = [];
  for (const line of lines) {
    if (!line) continue;
    const match = SCRIPT_RE.exec(line);
    if (!match?.groups) continue;
    const count = Number(match.groups.count ?? 1);
    const sleep = match.groups.sleep ? Number(match.groups.sleep) : undefined;
    commands.push({
      command: match.groups.command,
      param: match.groups.param,
      count,
      sleep
    });
  }
  return commands;
}

export async function runScript(roku: Roku, commands: ScriptCommand[], sleep = 0.5): Promise<void> {
  for (const command of commands) {
    for (let i = 0; i < (command.count || 1); i += 1) {
      const action = (roku as Record<string, any>)[command.command];
      if (!action) {
        throw new RokuValidationError(`Unknown command ${command.command}`);
      }
      if (command.param) {
        await action.call(roku, command.param);
      } else {
        await action.call(roku);
      }
      await new Promise((resolve) => setTimeout(resolve, (command.sleep ?? sleep) * 1000));
    }
  }
}
