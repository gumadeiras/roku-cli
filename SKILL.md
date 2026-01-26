## Roku CLI Skill

Purpose: Provide concise guidance for using the Roku CLI and bridge.

### Core Commands
- `roku discover --save <alias> --index <n>`: find devices and save an alias
- `roku <host|alias>`: interactive mode (fast, no SSDP)
- `roku --host <host|alias> command <name>`: send a key
- `roku --host <host|alias> search --app <name>`: search installed apps
- `roku --host <host|alias> launch <appId|alias>`: launch an app

### Bridge
- Start: `roku --host <host|alias> bridge --listen 19839 --token secret`
- Send: `POST /key`, `POST /text`, `POST /search`, `POST /launch`, `GET /health`
- Auth: `Authorization: Bearer <token>` or `x-roku-token: <token>`
