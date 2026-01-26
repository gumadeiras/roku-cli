import readline from "node:readline";
import type { Roku } from "../roku";
import { callKey } from "./actions";
import { startCommandServer } from "./bridge";

export type InteractiveOptions = {
  listenPort?: number;
  token?: string;
};

export async function runInteractive(roku: Roku, options: InteractiveOptions = {}): Promise<void> {
  printInteractiveGuide();
  process.stdin.setEncoding("utf-8");
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  const doubleTapMs = 350;
  let escTimer: NodeJS.Timeout | null = null;
  const server = options.listenPort
    ? await startCommandServer(roku, { port: options.listenPort, token: options.token })
    : null;
  if (server) {
    process.stdout.write(`Command port listening on 127.0.0.1:${server.port}\n`);
  }

  const keyMap: Record<string, () => Promise<void>> = {
    h: () => callKey(roku, "left"),
    j: () => callKey(roku, "down"),
    k: () => callKey(roku, "up"),
    l: () => callKey(roku, "right"),
    H: () => callKey(roku, "home"),
    B: () => callKey(roku, "back"),
    p: () => callKey(roku, "power"),
    R: () => callKey(roku, "replay"),
    i: () => callKey(roku, "info"),
    r: () => callKey(roku, "reverse"),
    f: () => callKey(roku, "forward"),
    " ": () => callKey(roku, "play"),
    V: () => callKey(roku, "volume_up"),
    v: () => callKey(roku, "volume_down"),
    M: () => callKey(roku, "volume_mute"),
    "\r": () => callKey(roku, "select")
  };

  const handleChunk = async (chunk: string) => {
    if (chunk === "q") {
      exitInteractive();
      return;
    }
    if (chunk === "\u001b") {
      if (escTimer) {
        clearTimeout(escTimer);
        escTimer = null;
        await callKey(roku, "home");
        return;
      }
      escTimer = setTimeout(() => {
        escTimer = null;
        void callKey(roku, "back");
      }, doubleTapMs);
      return;
    }
    if (chunk === "/") {
      await promptForText(roku);
      return;
    }
    if (chunk === "\u001b[A") {
      await callKey(roku, "up");
      return;
    }
    if (chunk === "\u001b[B") {
      await callKey(roku, "down");
      return;
    }
    if (chunk === "\u001b[C") {
      await callKey(roku, "right");
      return;
    }
    if (chunk === "\u001b[D") {
      await callKey(roku, "left");
      return;
    }
    const action = keyMap[chunk];
    if (action) {
      await action();
    }
  };

  process.stdin.on("data", (chunk) => {
    void handleChunk(chunk.toString());
  });

  const exitInteractive = () => {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    server?.close();
    process.stdout.write("\nExiting interactive mode.\n");
  };

  process.on("SIGINT", () => {
    exitInteractive();
    process.exit(0);
  });
}

async function promptForText(roku: Roku): Promise<void> {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const text = await new Promise<string>((resolve) => {
    rl.question("Enter text: ", (answer) => resolve(answer));
  });
  rl.close();
  if (text) {
    await roku.literal(text);
  }
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdout.write("\n");
}

function printInteractiveGuide(): void {
  const reset = "\u001b[0m";
  const bold = "\u001b[1m";
  const cyan = "\u001b[36m";
  const magenta = "\u001b[35m";
  const dim = "\u001b[2m";
  const header = `${bold}${cyan}Roku Interactive Mode${reset}`;
  const section = (title: string) => `${bold}${magenta}${title}${reset}`;
  const hint = (text: string) => `${dim}${text}${reset}`;
  process.stdout.write(
    [
      "",
      header,
      section("Navigation"),
      `  ${cyan}↑/k${reset} Up   ${cyan}↓/j${reset} Down   ${cyan}←/h${reset} Left   ${cyan}→/l${reset} Right   ${cyan}Enter${reset} OK`,
      section("Core"),
      `  ${cyan}H/Esc+Esc${reset} Home   ${cyan}B${reset} Back   ${cyan}Esc${reset} Back   ${cyan}i${reset} Info   ${cyan}p${reset} Power`,
      section("Playback"),
      `  ${cyan}r${reset} Rewind   ${cyan}f${reset} Fast‑Fwd   ${cyan}Space${reset} Play/Pause   ${cyan}R${reset} Replay`,
      section("Audio"),
      `  ${cyan}V${reset} Vol+   ${cyan}v${reset} Vol-   ${cyan}M${reset} Mute`,
      section("Text"),
      `  ${cyan}/${reset} Enter text`,
      "",
      hint("Press q to exit"),
      ""
    ].join("\n") + "\n"
  );
}
