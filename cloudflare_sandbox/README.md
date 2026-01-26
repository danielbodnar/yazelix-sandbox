# Yazelix Cloudflare Sandbox

Run Yazelix (a terminal IDE combining Yazi, Zellij, and Helix) in an isolated Cloudflare Sandbox environment.

## Prerequisites

- Node.js 16.17.0+
- Docker (for local development)
- Cloudflare account with Workers Paid plan (for production deployment)
- Wrangler CLI (`npm install -g wrangler`)

## Quick Start

### Local Development

```bash
cd cloudflare_sandbox

# Install dependencies
npm install

# Start development server (first run builds Docker container, takes 2-3 min)
npm run dev

# Test endpoints
curl http://localhost:8787/health
curl http://localhost:8787/status
```

### Production Deployment

```bash
# Login to Cloudflare
wrangler login

# Deploy to Cloudflare Workers
npm run deploy
```

Allow 2-3 minutes for initial provisioning before making requests.

## API Endpoints

### Health & Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check and available endpoints |
| `/status` | GET | Sandbox status and installed tools |

### Setup

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/setup` | POST | Initialize Yazelix environment with configs |

### Command Execution

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/exec` | POST | Execute arbitrary shell command |

**Request body:**
```json
{
  "command": "echo 'Hello World'",
  "cwd": "/workspace"
}
```

### Tool-Specific Operations

#### Helix Editor (`/helix`)

| Action | Description |
|--------|-------------|
| `version` | Get Helix version |
| `health` | Run Helix health check |
| `grammar` | Fetch and build grammars |
| `open` | Check if file exists |
| `edit` | Write content to file |

**Example:**
```bash
curl -X POST http://localhost:8787/helix \
  -H "Content-Type: application/json" \
  -d '{"action": "version"}'
```

#### Yazi File Manager (`/yazi`)

| Action | Description |
|--------|-------------|
| `version` | Get Yazi version |
| `list` | List directory contents |
| `tree` | Show file tree |

#### Zellij Multiplexer (`/zellij`)

| Action | Description |
|--------|-------------|
| `version` | Get Zellij version |
| `list-sessions` | List active sessions |
| `layouts` | Show available layouts |
| `setup-layout` | Create Yazelix layout |

### File Operations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/files?path=/workspace` | GET | List files |
| `/files?path=/workspace&recursive=true` | GET | List files recursively |
| `/file?path=/workspace/file.txt` | GET | Read file |
| `/file` | POST | Write file |
| `/file?path=/workspace/file.txt` | DELETE | Delete file |

**Write file example:**
```bash
curl -X POST http://localhost:8787/file \
  -H "Content-Type: application/json" \
  -d '{"path": "/workspace/hello.txt", "content": "Hello, Yazelix!"}'
```

## Sandbox Instances

Use the `id` query parameter to create multiple isolated sandbox instances:

```bash
# Default instance
curl http://localhost:8787/status

# Named instance
curl "http://localhost:8787/status?id=my-project"

# Each instance has its own filesystem and state
curl -X POST "http://localhost:8787/setup?id=my-project"
```

## Installed Tools

The sandbox container includes:

- **Helix** - Modern text editor
- **Yazi** - Terminal file manager
- **Zellij** - Terminal multiplexer
- **Nushell** - Modern shell
- **Starship** - Cross-shell prompt
- **Zoxide** - Smarter cd command
- **Ripgrep** - Fast grep alternative
- **fd** - Fast find alternative
- **bat** - Cat with syntax highlighting
- **fzf** - Fuzzy finder
- **eza** - Modern ls replacement
- **lazygit** - Git TUI
- **git** - Version control

## Usage Example

```bash
# 1. Initialize the environment
curl -X POST http://localhost:8787/setup

# 2. Create a new project
curl -X POST http://localhost:8787/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "mkdir -p /workspace/my-project && cd /workspace/my-project && git init"}'

# 3. Create a file
curl -X POST http://localhost:8787/file \
  -H "Content-Type: application/json" \
  -d '{"path": "/workspace/my-project/main.rs", "content": "fn main() {\n    println!(\"Hello from Yazelix Sandbox!\");\n}"}'

# 4. List project files
curl "http://localhost:8787/files?path=/workspace/my-project"

# 5. Check Helix can open the file
curl -X POST http://localhost:8787/helix \
  -H "Content-Type: application/json" \
  -d '{"action": "open", "file": "/workspace/my-project/main.rs"}'
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Cloudflare Workers                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Yazelix Sandbox Worker              │    │
│  │  • API routing                                   │    │
│  │  • Request handling                              │    │
│  │  • Response formatting                           │    │
│  └─────────────────┬───────────────────────────────┘    │
│                    │                                     │
│  ┌─────────────────▼───────────────────────────────┐    │
│  │           Sandbox Container (Durable Object)     │    │
│  │  ┌─────────────────────────────────────────┐    │    │
│  │  │              Nix Environment             │    │    │
│  │  │  • Helix    • Yazi      • Zellij        │    │    │
│  │  │  • Nushell  • Starship  • Zoxide        │    │    │
│  │  │  • ripgrep  • fd        • lazygit       │    │    │
│  │  └─────────────────────────────────────────┘    │    │
│  │  ┌─────────────────────────────────────────┐    │    │
│  │  │              /workspace                  │    │    │
│  │  │  Persistent file storage                 │    │    │
│  │  └─────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Configuration

The Dockerfile sets up the container with Nix package manager and installs all Yazelix tools. The `/setup` endpoint configures:

- Helix with Catppuccin theme and sensible defaults
- Yazi with file type associations
- Zellij with Yazelix-compatible settings

## Limitations

- Interactive terminal sessions are not supported via HTTP API
- Use for headless operations, file management, and code execution
- For interactive Yazelix experience, use the desktop/terminal installation

## License

MIT
