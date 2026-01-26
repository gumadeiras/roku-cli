# Roku CLI

Fast TypeScript CLI and library for controlling Roku devices via the ECP API.

## Highlights
- Full ECP control (keys, text, search, apps, device info, media state).
- Interactive mode for remote-like control from the terminal.
- Local bridge mode for other apps to send commands over HTTP.
- SSDP discovery, emulator server, and proxy tools.
- Strong typing, retries, timeouts, and better error handling.

## Requirements
- Node 18+ (Node 20+ recommended)

## Install (recommended)
```bash
npm install -g roku-ts-cli@latest
```

```bash
# or install locally for development
npm install
npm run build
npm link
```

## Quick Start
```bash
# Discover devices and save an alias
roku discover --save livingroom --index 1

# Use the alias
roku --host livingroom device-info
roku --host livingroom apps
```

## CLI Usage
```bash
# Direct host (fast, no SSDP)
roku 192.168.1.118

# Commands
roku --host livingroom command home
roku --host livingroom literal "hello"
roku --host livingroom search --title "Stargate"

# App lookup / aliases
roku --host livingroom search --app plex
roku alias set plex 13535
roku --host livingroom launch plex
```

## Interactive Mode
```bash
# Interactive control
roku livingroom

# With local command port
roku --host livingroom interactive --listen 19839 --token secret
```

## Bridge Mode (Local HTTP)
```bash
roku --host livingroom bridge --listen 19839 --token secret
```

Send commands from other apps:
```bash
curl -X POST http://127.0.0.1:19839/key \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer secret" \
  -d '{"key":"home"}'

curl -X POST http://127.0.0.1:19839/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer secret" \
  -d '{"text":"hello"}'
```

Endpoints:
- `POST /key` `{ "key": "home" }`
- `POST /text` `{ "text": "hello" }`
- `POST /search` `{ "title": "Stargate" }`
- `POST /launch` `{ "app": "plex" }`
- `GET /health`

## Emulator & Proxy
```bash
# Local emulator (HTTP + SSDP)
roku server --port 8060

# Forward requests to a real Roku
roku proxy --remote-host 192.168.1.10 --local-port 8061
```

## Library Usage
```ts
import { Roku } from "roku-ts-cli";

const roku = new Roku("192.168.1.10");
const apps = await roku.getApps();
await roku.home();
```

## Tests
```bash
npm run build
npm test
```

## License
MIT
