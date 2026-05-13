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
brew tap gumadeiras/tap
brew install roku-cli
```

```bash
npm install -g roku-ts-cli@latest
```

```bash
# local development
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
- `GET /stats`

## Run Bridge as a Service
You can run the bridge in the background using your OS service manager.

### macOS + Linux (user service)
Install and manage the service entirely through the CLI (no manual plist/unit edits needed):
```bash
# Install service file
roku bridge install-service --port 19839 --token YOUR_TOKEN --host YOUR_HOST_OR_ALIAS --user

# Start/stop/restart
roku bridge start --port 19839 --token YOUR_TOKEN --host YOUR_HOST_OR_ALIAS --user
roku bridge stop --user
roku bridge restart --port 19839 --token YOUR_TOKEN --host YOUR_HOST_OR_ALIAS --user

# Status + logs (+ optional health probe if port/token provided)
roku bridge status --user
roku bridge status --port 19839 --token YOUR_TOKEN

# Diagnose service issues (shows paths + logs, token redacted)
roku bridge diagnose --user

# Uninstall
roku bridge uninstall --user
```

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
npm test
```

## Maintainer Scripts
```bash
# commit only selected paths
./scripts/committer "fix: tighten packaging" package.json README.md

# validate a release version
./scripts/release check 1.1.3

# build the npm tarball + checksums
./scripts/release package 1.1.3

# full release flow
./scripts/release run 1.1.3
```

Tag pushes run the GitHub release workflow, publish a package tarball as a
release asset, publish npm, and update `gumadeiras/homebrew-tap`.
`./scripts/release publish` publishes the tarball from `dist/release/` to npm.
Add `--dry-run` to rehearse the npm publish step without shipping.

Release CI publishes to npm with trusted publishing.

## License
MIT
