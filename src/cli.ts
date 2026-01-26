#!/usr/bin/env node
import { Roku } from "./roku";
import { discover } from "./discovery";
import { Emulator } from "./emulator";
import { RokuServer } from "./server";
import { RokuProxy } from "./proxy";
import { loadScript, parseScript, runScript } from "./scripting";
import { startCommandServer } from "./cli/bridge";
import { runInteractive } from "./cli/interactive";
import { printCommandHelpByParts, printUsage, TOP_LEVEL_COMMANDS } from "./cli/help";
import {
  resolveHostInput,
  parseHostInput,
  isHostLike,
  normalizeDeviceLocation,
  loadAliasData,
  saveAliasData,
  saveDeviceAlias,
  removeAlias,
  resolveAppAlias,
  isNumericAppId,
  loadAliasesSync
} from "./cli/aliases";
import { searchInstalledApps } from "./cli/actions";

type GlobalOptions = {
  host?: string;
  alias?: string;
  port?: number;
  timeout?: number;
  retries?: number;
  json?: boolean;
};

type ParsedArgs = {
  command?: string;
  positionals: string[];
  options: Record<string, string | boolean | string[]>;
};

const parsed = parseArgs(process.argv.slice(2));

main(parsed).catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});

async function main(parsedArgs: ParsedArgs): Promise<void> {
  const command = parsedArgs.command;
  if (!command) {
    printUsage();
    return;
  }
  const options = toGlobalOptions(parsedArgs.options);
  if (parsedArgs.options.help && command !== "help") {
    printCommandHelpByParts(command, parsedArgs.positionals);
    return;
  }

  switch (command) {
    case "help": {
      if (parsedArgs.positionals.length) {
        printCommandHelpByParts(parsedArgs.positionals[0], parsedArgs.positionals.slice(1));
        return;
      }
      printUsage();
      return;
    }
    case "interactive": {
      const roku = buildRoku(options);
      const listenPort = toNumber(parsedArgs.options.listen);
      const token = asString(parsedArgs.options.token);
      await runInteractive(roku, { listenPort, token });
      return;
    }
    case "bridge": {
      const roku = buildRoku(options);
      const listenPort = toNumber(parsedArgs.options.listen, 19839);
      if (!listenPort) throw new Error("Missing --listen <port>");
      const token = asString(parsedArgs.options.token);
      const server = await startCommandServer(roku, { port: listenPort, token });
      process.stdout.write(`Bridge listening on 127.0.0.1:${server.port}\n`);
      await new Promise<void>(() => {
        // keep process alive
      });
      return;
    }
    case "discover": {
      const timeout = toNumber(parsedArgs.options.timeout, 2000);
      const retries = toNumber(parsedArgs.options.retries, 1);
      const devices = await discover({ timeoutMs: timeout, retries });
      const alias = asString(parsedArgs.options.save);
      if (alias) {
        if (!devices.length) {
          throw new Error("No devices discovered to save");
        }
        const rawIndex = toNumber(parsedArgs.options.index, 1) ?? 1;
        const index = rawIndex - 1;
        if (index < 0 || index >= devices.length) {
          throw new Error(
            `Invalid index ${rawIndex}. Discovered ${devices.length} device(s).`
          );
        }
        await saveDeviceAlias(alias, normalizeDeviceLocation(devices[index].location));
      }
      printResult(options, devices);
      return;
    }
    case "alias": {
      const [action, alias, value] = parsedArgs.positionals;
      if (action === "help") {
        printCommandHelpByParts("alias", []);
        return;
      }
      if (!action) throw new Error("Missing alias action (set|remove|list)");
      if (action === "set") {
        if (parsedArgs.options.help) {
          printCommandHelpByParts("alias", ["set"]);
          return;
        }
        if (!alias || !value) throw new Error("Usage: alias set <alias> <host|appId>");
        const data = await loadAliasData();
        if (isNumericAppId(value)) {
          data.apps[alias] = value;
        } else {
          data.devices[alias] = value;
        }
        await saveAliasData(data);
        return;
      }
      if (action === "remove") {
        if (parsedArgs.options.help) {
          printCommandHelpByParts("alias", ["remove"]);
          return;
        }
        if (!alias) throw new Error("Usage: alias remove <alias>");
        await removeAlias(alias);
        return;
      }
      if (action === "list") {
        if (parsedArgs.options.help) {
          printCommandHelpByParts("alias", ["list"]);
          return;
        }
        const data = await loadAliasData();
        printResult(options, data);
        return;
      }
      throw new Error(
        `Unknown alias action ${action}. Use "roku help alias" for usage.`
      );
    }
    case "commands": {
      const roku = buildRoku(options);
      printResult(options, roku.commands);
      return;
    }
    case "device-info": {
      const roku = buildRoku(options);
      printResult(options, await roku.getDeviceInfo());
      return;
    }
    case "apps": {
      const roku = buildRoku(options);
      printResult(options, await roku.getApps());
      return;
    }
    case "active-app": {
      const roku = buildRoku(options);
      printResult(options, await roku.getActiveApp());
      return;
    }
    case "current-app": {
      const roku = buildRoku(options);
      printResult(options, await roku.getCurrentApp());
      return;
    }
    case "launch": {
      const [appId] = parsedArgs.positionals;
      if (!appId) throw new Error("Missing appId");
      const roku = buildRoku(options);
      const app = await roku.getApp(resolveAppAlias(appId));
      if (!app) throw new Error(`App ${appId} not found`);
      await roku.launch(app);
      return;
    }
    case "store": {
      const [appId] = parsedArgs.positionals;
      if (!appId) throw new Error("Missing appId");
      const roku = buildRoku(options);
      const app = await roku.getApp(resolveAppAlias(appId));
      if (!app) throw new Error(`App ${appId} not found`);
      await roku.store(app);
      return;
    }
    case "icon": {
      const [appId] = parsedArgs.positionals;
      if (!appId) throw new Error("Missing appId");
      const roku = buildRoku(options);
      const app = await roku.getApp(resolveAppAlias(appId));
      if (!app) throw new Error(`App ${appId} not found`);
      const data = await roku.icon(app);
      const out = asString(parsedArgs.options.out);
      if (out) {
        const { writeFile } = await import("node:fs/promises");
        await writeFile(out, data);
        return;
      }
      printResult(options, data.toString("base64"));
      return;
    }
    case "command": {
      const [name] = parsedArgs.positionals;
      if (!name) throw new Error("Missing command name");
      const roku = buildRoku(options);
      const action = (roku as any)[name];
      if (!action) {
        throw new Error(
          `Unknown key command ${name}. Use "roku commands" to list valid keys.`
        );
      }
      await action.call(roku, asString(parsedArgs.options.state));
      return;
    }
    case "literal": {
      const [text] = parsedArgs.positionals;
      if (!text) throw new Error("Missing text");
      const roku = buildRoku(options);
      await roku.literal(text);
      return;
    }
    case "search": {
      const roku = buildRoku(options);
      const appQuery = asString(parsedArgs.options.app);
      if (appQuery) {
        const apps = await roku.getApps();
        const term = appQuery.toLowerCase();
        const matches = apps.filter(
          (app) => app.name.toLowerCase().includes(term) || app.id.includes(appQuery)
        );
        printResult(options, matches);
        return;
      }
      const params: Record<string, string> = {};
      const title = asString(parsedArgs.options.title);
      const providerId = asString(parsedArgs.options["provider-id"]);
      const provider = asString(parsedArgs.options.provider);
      if (title) params.title = title;
      if (providerId) params["provider-id"] = providerId;
      if (provider) params.provider = provider;
      await roku.search(params);
      return;
    }
    case "input": {
      const key = asString(parsedArgs.options.key);
      const value = asString(parsedArgs.options.value);
      if (!key || !value) throw new Error("Missing --key or --value");
      const roku = buildRoku(options);
      await roku.input({ [key]: value });
      return;
    }
    case "touch": {
      const x = toNumber(parsedArgs.options.x);
      const y = toNumber(parsedArgs.options.y);
      const op = asString(parsedArgs.options.op) ?? "down";
      if (x === undefined || y === undefined) throw new Error("Missing --x or --y");
      const roku = buildRoku(options);
      await roku.touch(x, y, op as any);
      return;
    }
    case "sensor": {
      const [name] = parsedArgs.positionals;
      if (!name) throw new Error("Missing sensor name");
      const x = toNumber(parsedArgs.options.x);
      const y = toNumber(parsedArgs.options.y);
      const z = toNumber(parsedArgs.options.z);
      if (x === undefined || y === undefined || z === undefined) {
        throw new Error("Missing --x, --y, or --z");
      }
      const roku = buildRoku(options);
      const action = (roku as any)[name];
      if (!action) {
        throw new Error(
          `Unknown sensor ${name}. Use "sensor acceleration|magnetic|orientation|rotation".`
        );
      }
      await action.call(roku, x, y, z);
      return;
    }
    case "script": {
      const [scriptPath] = parsedArgs.positionals;
      if (!scriptPath) throw new Error("Missing script path");
      const params: Record<string, string> = {};
      const paramValues = asStringArray(parsedArgs.options.param);
      for (const entry of paramValues) {
        const [key, value] = entry.split("=");
        if (key && value) params[key] = value;
      }
      const roku = buildRoku(options);
      const lines = (await loadScript(scriptPath, params, false)) as string[];
      const commands = parseScript(lines);
      await runScript(roku, commands);
      return;
    }
    case "server": {
      const port = toNumber(parsedArgs.options.port, 8060);
      const server = new RokuServer({ port, emulator: new Emulator() });
      await server.start();
      process.stdout.write(`Roku emulator listening on ${server.getPort()}\n`);
      return;
    }
    case "proxy": {
      const remoteHost = asString(parsedArgs.options["remote-host"]);
      if (!remoteHost) throw new Error("Missing --remote-host");
      const remotePort = toNumber(parsedArgs.options["remote-port"], 8060);
      const localPort = toNumber(parsedArgs.options["local-port"], 8060);
      const proxy = new RokuProxy({
        remoteHost,
        remotePort,
        localPort
      });
      await proxy.start();
      process.stdout.write(`Proxy listening on ${proxy.getPort()}\n`);
      return;
    }
    default:
      throw new Error(`Unknown command ${command}. Use "roku help" to list commands.`);
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = { positionals: [], options: {} };
  let i = 0;
  if (argv[0] && !argv[0].startsWith("--")) {
    const candidate = argv[0];
    const isAlias = Boolean(loadAliasesSync().devices[candidate]);
    if (isHostLike(candidate) || isAlias) {
      const next = argv[1];
      if (!next) {
        result.options.host = candidate;
        result.command = "interactive";
        return result;
      }
      if (TOP_LEVEL_COMMANDS.has(next)) {
        result.options.host = candidate;
        i = 1;
      }
    }
  }
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      const next = argv[i + 1];
      const isBool = name === "json" || name === "help";
      if (isBool) {
        addOption(result.options, name, true);
        i += 1;
      } else if (!next || next.startsWith("--")) {
        addOption(result.options, name, "");
        i += 1;
      } else {
        addOption(result.options, name, next);
        i += 2;
      }
      continue;
    }
    if (!result.command) {
      result.command = arg;
    } else {
      result.positionals.push(arg);
    }
    i += 1;
  }
  return result;
}

function addOption(
  options: Record<string, string | boolean | string[]>,
  name: string,
  value: string | boolean
): void {
  const existing = options[name];
  if (existing === undefined) {
    options[name] = value;
    return;
  }
  if (Array.isArray(existing)) {
    existing.push(String(value));
  } else {
    options[name] = [String(existing), String(value)];
  }
}

function toGlobalOptions(options: Record<string, string | boolean | string[]>): GlobalOptions {
  return {
    host: asString(options.host),
    alias: asString(options.alias),
    port: toNumber(options.port, 8060),
    timeout: toNumber(options.timeout, 10000),
    retries: toNumber(options.retries, 0),
    json: Boolean(options.json)
  };
}

function asString(value: string | boolean | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value[0];
  if (typeof value === "boolean") return value ? "true" : undefined;
  return value;
}

function asStringArray(value: string | boolean | string[] | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "boolean") return [];
  return [value];
}

function toNumber(value: string | boolean | string[] | undefined, fallback?: number): number | undefined {
  if (value === undefined) return fallback;
  const text = asString(value);
  if (!text) return fallback;
  const parsed = Number(text);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function buildRoku(options: GlobalOptions): Roku {
  const hostInput = resolveHostInput(options.host, options.alias);
  if (!hostInput) {
    throw new Error("Missing --host or --alias");
  }
  const parsed = parseHostInput(hostInput);
  return new Roku(parsed.host, parsed.port ?? options.port ?? 8060, {
    timeoutMs: options.timeout,
    retries: options.retries
  });
}

function printResult(options: GlobalOptions, result: unknown): void {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (typeof result === "string") {
    process.stdout.write(`${result}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
