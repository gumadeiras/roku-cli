export type HelpEntry = { usage: string; description: string; examples: string[] };

export const COMMAND_HELP: Record<string, HelpEntry> = {
  help: {
    usage: "roku help [command]",
    description: "Show command help with usage, options, and examples.",
    examples: ["roku help", "roku help search"]
  },
  interactive: {
    usage: "roku <host|alias> interactive [--listen <port>] [--token <token>]",
    description:
      "Start an interactive remote session. Optional local HTTP listener lets other apps send commands while you control the Roku.",
    examples: [
      "roku 192.168.1.118",
      "roku --host projector interactive",
      "roku --host projector interactive --listen 19839 --token secret"
    ]
  },
  discover: {
    usage: "roku discover [--timeout <ms>] [--retries <count>] [--save <alias>] [--index <n>]",
    description:
      "Discover Roku devices on your LAN using SSDP. Optionally save a device as an alias for later use.",
    examples: [
      "roku discover",
      "roku discover --save livingroom",
      "roku discover --save livingroom --index 2"
    ]
  },
  alias: {
    usage: "roku alias <set|remove|list> [args]",
    description:
      "Create, remove, and list aliases for devices (host:port) and apps (app id).",
    examples: [
      "roku alias list",
      "roku alias set projector 192.168.50.73:8060",
      "roku alias set plex 13535",
      "roku alias remove projector"
    ]
  },
  "alias set": {
    usage: "roku alias set <alias> <host|appId>",
    description:
      "Save a device alias (host:port or URL) or an app alias (numeric app id).",
    examples: [
      "roku alias set projector 192.168.50.73:8060",
      "roku alias set plex 13535"
    ]
  },
  "alias remove": {
    usage: "roku alias remove <alias>",
    description: "Delete an alias from both device and app mappings.",
    examples: ["roku alias remove projector", "roku alias remove plex"]
  },
  "alias list": {
    usage: "roku alias list",
    description: "Show all saved device and app aliases.",
    examples: ["roku alias list"]
  },
  commands: {
    usage: "roku --host <host|alias> commands",
    description: "List supported key commands for the target device.",
    examples: ["roku --host projector commands"]
  },
  "device-info": {
    usage: "roku --host <host|alias> device-info",
    description: "Print hardware/software metadata for the target device.",
    examples: ["roku --host projector device-info"]
  },
  apps: {
    usage: "roku --host <host|alias> apps",
    description: "List installed apps with id, name, and version.",
    examples: ["roku --host projector apps"]
  },
  "active-app": {
    usage: "roku --host <host|alias> active-app",
    description: "Show the app currently in the foreground.",
    examples: ["roku --host projector active-app"]
  },
  "current-app": {
    usage: "roku --host <host|alias> current-app",
    description: "Show the current app, including screensaver if active.",
    examples: ["roku --host projector current-app"]
  },
  launch: {
    usage: "roku --host <host|alias> launch <appId|appName>",
    description:
      "Launch an app by id, name, or app alias (saved via `roku alias set`).",
    examples: [
      "roku --host projector launch 12",
      "roku --host projector launch Plex",
      "roku --host projector launch plex"
    ]
  },
  store: {
    usage: "roku --host <host|alias> store <appId|appName>",
    description: "Open the channel store page for the given app.",
    examples: ["roku --host projector store 12"]
  },
  icon: {
    usage: "roku --host <host|alias> icon <appId|appName> [--out <path>]",
    description: "Fetch an app icon and print base64 or save to a file.",
    examples: [
      "roku --host projector icon 12",
      "roku --host projector icon 12 --out ./icon.png",
      "roku --host projector icon plex --out ./icon.png"
    ]
  },
  command: {
    usage: "roku --host <host|alias> command <name> [--state keydown|keyup]",
    description: "Send a keypress (home, back, play, etc) to the device.",
    examples: ["roku --host projector command home", "roku --host projector command back"]
  },
  literal: {
    usage: "roku --host <host|alias> literal <text>",
    description: "Type text on the Roku using the ECP literal endpoint.",
    examples: ["roku --host projector literal \"hello\""]
  },
  search: {
    usage:
      "roku --host <host|alias> search [--title <title>] [--provider-id <id>] [--provider <name>] [--app <name>]",
    description:
      "Search content via ECP, or search installed apps with --app.",
    examples: [
      "roku --host projector search --title \"Stargate\"",
      "roku --host projector search --app plex"
    ]
  },
  input: {
    usage: "roku --host <host|alias> input --key <key> --value <value>",
    description: "Send raw input parameters to the ECP /input endpoint.",
    examples: ["roku --host projector input --key VolumeUp --value 1"]
  },
  touch: {
    usage: "roku --host <host|alias> touch --x <x> --y <y> [--op <op>]",
    description: "Send a touch event for touch-capable devices.",
    examples: ["roku --host projector touch --x 120 --y 300 --op press"]
  },
  sensor: {
    usage: "roku --host <host|alias> sensor <name> --x <x> --y <y> --z <z>",
    description: "Send sensor values (acceleration, magnetic, orientation, rotation).",
    examples: ["roku --host projector sensor acceleration --x 1 --y 2 --z 3"]
  },
  script: {
    usage: "roku --host <host|alias> script <path> [--param key=value]",
    description: "Run a script of Roku commands with optional parameters.",
    examples: ["roku --host projector script ./scripts/test.txt --param avar=here"]
  },
  server: {
    usage: "roku server [--port <port>]",
    description:
      "Start a local Roku emulator (HTTP + SSDP) for testing without a real device.",
    examples: ["roku server --port 8060"]
  },
  proxy: {
    usage: "roku proxy --remote-host <host> [--remote-port <port>] [--local-port <port>]",
    description:
      "Start a local proxy that forwards ECP requests to a real Roku.",
    examples: ["roku proxy --remote-host 192.168.1.10 --local-port 8060"]
  },
  bridge: {
    usage:
      "roku --host <host|alias> bridge --listen <port> [--listen-host <host>] [--token <token>]\n  roku bridge install-service --port <port> --token <token> --host <host|alias> [--listen-host <host>] [--user]\n  roku bridge start --port <port> --token <token> --host <host|alias> [--listen-host <host>] [--user]\n  roku bridge stop [--user]\n  roku bridge restart --port <port> --token <token> --host <host|alias> [--listen-host <host>] [--user]\n  roku bridge status [--user] [--port <port> --token <token> [--listen-host <host>]]\n  roku bridge uninstall [--user]\n  roku bridge diagnose [--user]\n  roku bridge monitor --port <port> --token <token> [--listen-host <host>]",
    description:
      "Start a local HTTP bridge or monitor an existing bridge (health + latency + last event).",
    examples: [
      "roku --host projector bridge --listen 19839 --token secret",
      "roku bridge install-service --port 19839 --token secret --host projector --user",
      "roku bridge start --port 19839 --token secret --host projector --user",
      "roku bridge stop",
      "roku bridge restart --port 19839 --token secret --host projector --user",
      "roku bridge status --user",
      "roku bridge status --port 19839 --token secret",
      "roku bridge uninstall --user",
      "roku bridge diagnose --user",
      "roku bridge monitor --port 19839 --token secret"
    ]
  },
  "bridge monitor": {
    usage: "roku bridge monitor --port <port> --token <token> [--listen-host <host>]",
    description:
      "Monitor a running bridge with periodic health checks and last-event reporting.",
    examples: ["roku bridge monitor --port 19839 --token secret"]
  },
  "bridge install-service": {
    usage:
      "roku bridge install-service --port <port> --token <token> --host <host|alias> [--listen-host <host>] [--user]",
    description: "Install a system or user service for the bridge.",
    examples: [
      "roku bridge install-service --port 19839 --token secret --host projector --user"
    ]
  },
  "bridge start": {
    usage:
      "roku bridge start --port <port> --token <token> --host <host|alias> [--listen-host <host>] [--user]",
    description: "Start the installed bridge service.",
    examples: ["roku bridge start --port 19839 --token secret --host projector --user"]
  },
  "bridge stop": {
    usage: "roku bridge stop [--user]",
    description: "Stop the installed bridge service.",
    examples: ["roku bridge stop"]
  },
  "bridge restart": {
    usage:
      "roku bridge restart --port <port> --token <token> --host <host|alias> [--listen-host <host>] [--user]",
    description: "Restart the installed bridge service.",
    examples: ["roku bridge restart --port 19839 --token secret --host projector --user"]
  },
  "bridge status": {
    usage: "roku bridge status [--user] [--port <port> --token <token> [--listen-host <host>]]",
    description:
      "Show service status, PID, recent log lines, and optional health probe when port/token are provided.",
    examples: [
      "roku bridge status --user",
      "roku bridge status --port 19839 --token pinguini"
    ]
  },
  "bridge uninstall": {
    usage: "roku bridge uninstall [--user]",
    description: "Remove installed service files and stop the service if running.",
    examples: ["roku bridge uninstall --user"]
  },
  "bridge diagnose": {
    usage: "roku bridge diagnose [--user]",
    description:
      "Print service paths, resolved binaries, status output, and recent logs for troubleshooting.",
    examples: ["roku bridge diagnose --user"]
  }
};

export const TOP_LEVEL_COMMANDS = new Set([
  "help",
  "interactive",
  "discover",
  "alias",
  "commands",
  "device-info",
  "apps",
  "active-app",
  "current-app",
  "launch",
  "store",
  "icon",
  "command",
  "literal",
  "search",
  "input",
  "touch",
  "sensor",
  "script",
  "server",
  "proxy",
  "bridge"
]);

export function printCommandHelp(command: string): void {
  const entry = COMMAND_HELP[command];
  if (!entry) {
    process.stderr.write(`Unknown command ${command}. Use \"roku help\" to list commands.\n`);
    return;
  }
  process.stdout.write(
    [
      `${command}`,
      "",
      `Usage:`,
      `  ${entry.usage}`,
      "",
      `Description:`,
      `  ${entry.description}`,
      "",
      "Examples:",
      ...entry.examples.map((example) => `  ${example}`)
    ].join("\n") + "\n"
  );
}

export function printCommandHelpByParts(command: string, positionals: string[]): void {
  if (command === "alias" && positionals.length) {
    const sub = positionals[0];
    const key = `alias ${sub}`;
    if (COMMAND_HELP[key]) {
      printCommandHelp(key);
      return;
    }
  }
  printCommandHelp(command);
}

export function printUsage(): void {
  process.stdout.write(
    [
      "Roku CLI",
      "",
      "Usage:",
      "  roku [--host <host>] [--port <port>] [--timeout <ms>] [--retries <count>] [--json]",
      "  roku <host> <command> [command options]",
      "  roku <host>                       Start interactive mode",
      "  roku <command> [command options]",
      "",
      "Global options:",
      "  --host <host>       Roku host, alias, host:port, or URL",
      "  --port <port>       Roku port (default: 8060)",
      "  --timeout <ms>      Request timeout in ms (default: 10000)",
      "  --retries <count>   Retry count for requests (default: 0)",
      "  --alias <name>      Use saved alias instead of --host",
      "  --json              JSON output where applicable",
      "  --help              Show help for a command",
      "",
      "Commands:",
      "  help [command]                     Show help (or help for a command)",
      "  interactive                         Start interactive mode",
      "  bridge                              Start local HTTP bridge",
      "  discover                            Find devices via SSDP",
      "  discover --save <alias>             Save first discovered device as alias",
      "  discover --save <alias> --index <n> Save device at index",
      "  alias set <alias> <host>            Save alias for a host/IP",
      "  alias remove <alias>                Remove alias",
      "  alias list                          List saved aliases",
      "  commands                            List supported key commands",
      "  device-info                         Get device metadata",
      "  apps                                List installed apps",
      "  active-app                          Show active app",
      "  current-app                         Show current app or screensaver",
      "  launch <appId>                      Launch app by id or name",
      "  store <appId>                       Open channel store for app",
      "  icon <appId> [--out <path>]         Fetch app icon (base64 or file)",
      "  command <name> [--state keydown|keyup]  Send a key command",
      "  literal <text>                      Type text (ECP Lit)",
      "  search [--title <title>] [--provider-id <id>] [--provider <name>]",
      "                                      Search content",
      "  search --app <name>                 Search installed apps",
      "  input --key <key> --value <value>   Send raw input param",
      "  touch --x <x> --y <y> [--op <op>]    Touch input (down|up|press|move|cancel)",
      "  sensor <name> --x <x> --y <y> --z <z>  Sensor input (acceleration, etc)",
      "  script <path> [--param key=value]   Run a script file",
      "  server [--port <port>]              Start emulator server",
      "  proxy --remote-host <host> [--remote-port <port>] [--local-port <port>]",
      "                                      Start proxy to a real Roku",
      "",
      "Examples:",
      "  roku discover",
      "  roku 192.168.1.118 device-info",
      "  roku 192.168.1.118",
      "  roku 192.168.1.118 interactive --listen 19839",
      "  roku --host projector bridge --listen 19839",
      "  roku discover --save livingroom",
      "  roku discover --save livingroom --index 1",
      "  roku alias set office 192.168.1.20",
      "  roku help search",
      "  roku --host projector search --app plex",
      "  roku --alias livingroom device-info",
      "  roku --host 192.168.1.10 device-info",
      "  roku --host 192.168.1.10 command home",
      "  roku --host 192.168.1.10 literal \"hello\"",
      "  roku --host 192.168.1.10 search --title \"Stargate\"",
      "  roku --host 192.168.1.10 icon 12 --out ./icon.png",
      "  roku --host 192.168.1.10 script ./scripts/test.txt --param avar=here",
      "  roku server --port 8060",
      "  roku proxy --remote-host 192.168.1.10 --local-port 8060"
    ].join("\n") + "\n"
  );
}
