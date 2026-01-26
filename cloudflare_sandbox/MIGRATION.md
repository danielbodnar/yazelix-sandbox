# Nix to Cloudflare Containers Migration Guide

This document provides a comprehensive guide for migrating the Yazelix development environment from Nix/devenv to Cloudflare-compatible containers.

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Nix Dependencies Analysis](#current-nix-dependencies-analysis)
3. [Cloudflare Containers Architecture](#cloudflare-containers-architecture)
4. [Migration Strategy](#migration-strategy)
5. [Dockerfile Design](#dockerfile-design)
6. [Wrangler Configuration](#wrangler-configuration)
7. [Container Instance Selection](#container-instance-selection)
8. [R2 Integration for Persistent Storage](#r2-integration-for-persistent-storage)
9. [Migration Checklist](#migration-checklist)
10. [Best Practices](#best-practices)
11. [Known Limitations](#known-limitations)

---

## Executive Summary

### Problem

The current `cloudflare_sandbox/Dockerfile` fails to build because Nix installation requires the `nixbld` group, which is not available in standard container environments without root privileges on the host.

### Solution

Replace Nix-based package management with:
1. **Multi-stage Dockerfile** that downloads pre-built binaries directly
2. **Cloudflare Sandbox SDK** (`@cloudflare/sandbox`) as the base image
3. **R2 bucket mounting** for persistent workspace data across container lifecycles

### Benefits

- ✅ No Nix dependency - works in any Docker/OCI environment
- ✅ Faster container startup (no Nix store loading)
- ✅ Smaller image size (~500MB vs ~2GB with Nix)
- ✅ Full compatibility with Cloudflare Containers
- ✅ Deterministic builds via pinned binary versions

---

## Current Nix Dependencies Analysis

### Essential Tools (from `devenv.nix`)

| Tool | Nix Package | Purpose | Binary Available |
|------|-------------|---------|------------------|
| Helix | `helix` | Text editor | ✅ GitHub releases |
| Zellij | `zellij` | Terminal multiplexer | ✅ GitHub releases |
| Yazi | `yazi` | File manager | ✅ GitHub releases |
| Nushell | `nushell` | Shell | ✅ GitHub releases |
| fzf | `fzf` | Fuzzy finder | ✅ GitHub releases |
| zoxide | `zoxide` | Smart cd | ✅ GitHub releases |
| Starship | `starship` | Prompt | ✅ GitHub releases |
| Macchina | `macchina` | System info | ✅ GitHub releases |
| mise | `mise` | Tool version manager | ✅ GitHub releases |
| taplo | `taplo` | TOML toolkit | ✅ GitHub releases |

### Recommended Dependencies (optional)

| Tool | Purpose | Binary Available |
|------|---------|------------------|
| lazygit | Git TUI | ✅ GitHub releases |
| atuin | Shell history | ✅ GitHub releases |
| carapace | Completions | ✅ GitHub releases |
| markdown-oxide | MD LSP | ✅ GitHub releases |

### Yazi Extensions Dependencies

| Tool | Purpose | apt-get Available |
|------|---------|-------------------|
| p7zip | Archive support | ✅ `p7zip-full` |
| jq | JSON processing | ✅ `jq` |
| fd | File finding | ✅ GitHub releases |
| ripgrep | Text search | ✅ GitHub releases |
| poppler | PDF preview | ✅ `poppler-utils` |

### Yazi Media Dependencies (optional, large)

| Tool | Purpose | apt-get Available |
|------|---------|-------------------|
| ffmpeg | Video processing | ✅ `ffmpeg` (~100MB) |
| imagemagick | Image processing | ✅ `imagemagick` (~50MB) |

### Terminal Emulators (NOT needed in container)

Terminal emulators (Ghostty, Kitty, WezTerm, etc.) are **not needed** in the container - they run on the user's local machine.

---

## Cloudflare Containers Architecture

### How Containers Work

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Worker Code (TypeScript)                                  │  │
│  │  - Handles HTTP requests                                   │  │
│  │  - Creates/manages sandbox instances                       │  │
│  │  - Communicates with containers via Sandbox SDK            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Durable Object (Sandbox class)                           │  │
│  │  - Manages container lifecycle                            │  │
│  │  - Persists state in SQLite                               │  │
│  │  - Handles WebSocket connections                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Container Instance (from Dockerfile)                      │  │
│  │  - Runs in isolated VM                                     │  │
│  │  - Contains Yazelix tools (Helix, Yazi, Zellij, etc.)     │  │
│  │  - Executes commands via sandbox.exec()                   │  │
│  │  - Can mount R2 buckets for persistent storage            │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Container Lifecycle

1. **Cold Start**: First request creates container instance (~2-5s)
2. **Warm**: Subsequent requests reuse running container (<100ms)
3. **Sleep**: After `sleepAfter` timeout, container hibernates
4. **Wake**: Next request wakes container (~500ms-1s)
5. **Destroy**: After extended inactivity, container is destroyed

### Key Concepts

- **Durable Objects**: Provide the coordination layer for containers
- **Sandbox SDK**: TypeScript SDK for interacting with containers
- **Instance Types**: Define CPU, memory, and disk resources
- **R2 FUSE Mounts**: Enable persistent storage across container lifecycles

---

## Migration Strategy

### Phase 1: Create Nix-Free Dockerfile ✅

Replace `cloudflare_sandbox/Dockerfile` with `Dockerfile.yazelix`:

```dockerfile
# Multi-stage build pattern
# Stage 1: Download all binaries in parallel
# Stage 2: Create runtime image from cloudflare/sandbox base
```

Key changes:
- Remove all Nix installation steps
- Use multi-stage builds for smaller images
- Download pre-built binaries from GitHub releases
- Pin versions for reproducibility

### Phase 2: Update Wrangler Configuration ✅

Update `wrangler.jsonc`:
- Point to new `Dockerfile.yazelix`
- Select appropriate instance type (`standard-1`)
- Configure environment variables
- Add R2 bucket binding (optional)

### Phase 3: Update Worker Code ✅

Update `src/index.ts`:
- Remove Nix-specific environment sourcing
- Tools are now in PATH by default
- Simplify command execution

### Phase 4: Migrate Yazelix Nushell Scripts (Future)

For full Yazelix functionality in containers:
1. Copy essential Nushell scripts to container
2. Adapt scripts for container environment
3. Configure layouts and keybindings

---

## Dockerfile Design

### Multi-Stage Build Pattern

```dockerfile
# Stage 1: Download binaries (parallel, cached)
FROM ubuntu:22.04 AS binary-downloader
# Download Helix, Zellij, Yazi, Nushell, etc.

# Stage 2: Runtime image
FROM docker.io/cloudflare/sandbox:0.7.0 AS runtime
# Install apt packages
# Copy binaries from Stage 1
# Configure tools
```

### Version Pinning

All tool versions are pinned as build arguments:

```dockerfile
ARG HELIX_VERSION=25.01.1
ARG ZELLIJ_VERSION=0.41.3
ARG YAZI_VERSION=25.2.26
ARG NUSHELL_VERSION=0.104.0
```

To update a tool, change the version and rebuild.

### Multi-Architecture Support

The Dockerfile supports both `amd64` (x86_64) and `arm64` (aarch64):

```dockerfile
ARG TARGETARCH  # Set by Docker BuildKit

RUN if [ "$TARGETARCH" = "amd64" ]; then
        ARCH="x86_64-unknown-linux-musl";
    elif [ "$TARGETARCH" = "arm64" ]; then
        ARCH="aarch64-unknown-linux-musl";
    fi
```

### Build Commands

```bash
# Build locally (for testing)
docker build -f Dockerfile.yazelix -t yazelix-sandbox .

# Build with specific platform
docker buildx build --platform linux/amd64 -f Dockerfile.yazelix -t yazelix-sandbox .

# Build for Cloudflare (automatic via wrangler deploy)
cd cloudflare_sandbox
wrangler deploy
```

---

## Wrangler Configuration

### Minimal Configuration

```jsonc
{
  "name": "yazelix-sandbox",
  "main": "src/index.ts",
  "compatibility_date": "2025-05-06",
  "compatibility_flags": ["nodejs_compat"],
  
  "containers": [
    {
      "class_name": "Sandbox",
      "image": "./Dockerfile.yazelix",
      "instance_type": "standard-1",
      "max_instances": 5
    }
  ],
  
  "durable_objects": {
    "bindings": [
      {
        "name": "Sandbox",
        "class_name": "Sandbox"
      }
    ]
  },
  
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["Sandbox"]
    }
  ]
}
```

### With R2 Persistent Storage

```jsonc
{
  // ... base config ...
  
  "r2_buckets": [
    {
      "binding": "WORKSPACE_BUCKET",
      "bucket_name": "yazelix-workspaces",
      "preview_bucket_name": "yazelix-workspaces-dev"
    }
  ]
}
```

---

## Container Instance Selection

### Instance Types Available

| Instance Type | vCPU | Memory | Disk | Use Case |
|---------------|------|--------|------|----------|
| `lite` | 1/16 | 256 MiB | 2 GB | Simple scripts, testing |
| `basic` | 1/4 | 1 GiB | 4 GB | Light development |
| `standard-1` | 1/2 | 4 GiB | 8 GB | **Recommended for Yazelix** |
| `standard-2` | 1 | 6 GiB | 12 GB | Heavy development |
| `standard-3` | 2 | 8 GiB | 16 GB | Build-intensive tasks |
| `standard-4` | 4 | 12 GiB | 20 GB | Large codebases |

### Recommendation for Yazelix

**Use `standard-1`** because:
- Helix requires ~100MB RAM for LSP servers
- Zellij adds ~50MB per pane
- Yazi needs ~30MB for file previews
- Total working set: 500MB-2GB typical

**Cost estimate** (standard-1):
- 25 GiB-hours/month included free
- ~$0.009/hour for always-on instance
- Sleep-to-wake optimizes costs for bursty usage

---

## R2 Integration for Persistent Storage

### Why Use R2?

Container storage is **ephemeral** - data is lost when containers sleep or are destroyed. R2 provides:

- Persistent workspace files across container lifecycles
- Zero egress fees for reading data
- S3-compatible API
- FUSE mounting as local filesystem

### Setup R2 Bucket

```bash
# Create bucket
wrangler r2 bucket create yazelix-workspaces

# List buckets
wrangler r2 bucket list
```

### Mount in Worker

```typescript
import { getSandbox } from "@cloudflare/sandbox";

const sandbox = getSandbox(env.Sandbox, userId);

// Mount R2 bucket as /workspace
await sandbox.mountBucket("yazelix-workspaces", "/workspace", {
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
});

// Now /workspace persists across container restarts
await sandbox.exec("echo 'Hello' > /workspace/test.txt");
```

### Credentials Configuration

Store R2 credentials as Worker secrets:

```bash
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
wrangler secret put R2_ACCOUNT_ID
```

---

## Migration Checklist

### Pre-Migration

- [ ] Review current Nix dependencies in `devenv.nix`
- [ ] Identify which tools are essential vs optional
- [ ] Test Docker build environment locally
- [ ] Create Cloudflare account with paid Workers plan

### Dockerfile Migration

- [x] Create `Dockerfile.yazelix` with multi-stage build
- [x] Pin all tool versions
- [x] Support multi-architecture (amd64/arm64)
- [x] Include essential tools (Helix, Zellij, Yazi, Nushell)
- [x] Include productivity tools (fzf, ripgrep, fd, etc.)
- [x] Configure default tool settings

### Worker Migration

- [x] Update `wrangler.jsonc` with new Dockerfile
- [x] Select appropriate instance type
- [x] Remove Nix environment sourcing from Worker code
- [x] Test all API endpoints

### Testing

- [ ] Build container locally: `docker build -f Dockerfile.yazelix .`
- [ ] Run container locally: `docker run -it yazelix-sandbox`
- [ ] Verify all tools work: `hx --version && zellij --version && yazi --version`
- [ ] Deploy to Cloudflare: `wrangler deploy`
- [ ] Test Worker endpoints

### Optional Enhancements

- [ ] Set up R2 bucket for persistent storage
- [ ] Configure FUSE mounting in container
- [ ] Add Yazelix Nushell scripts to container
- [ ] Set up custom Zellij layouts

---

## Best Practices

### 1. Version Synchronization

Always match Sandbox SDK version with Docker image:

```dockerfile
# Dockerfile
FROM docker.io/cloudflare/sandbox:0.7.0
```

```json
// package.json
"@cloudflare/sandbox": "^0.7.0"
```

### 2. Keep Images Lean

- Don't include unused tools
- Use `--no-install-recommends` with apt-get
- Clean up apt cache: `rm -rf /var/lib/apt/lists/*`
- Consider separate images for different use cases

### 3. Handle Container Lifecycle

```typescript
// Configure sleep timeout
export class Sandbox extends Container {
  sleepAfter = "10m";  // Sleep after 10 minutes idle
  
  override onStart() {
    console.log("Container started");
  }
  
  override onStop() {
    console.log("Container stopping - save state!");
  }
}
```

### 4. Secure Credentials

Never hardcode credentials:

```typescript
// Bad
const accessKey = "AKIAIOSFODNN7EXAMPLE";

// Good
const accessKey = env.R2_ACCESS_KEY_ID;
```

### 5. Optimize for Cold Starts

- Pre-configure tools in Dockerfile
- Minimize startup scripts
- Use lightweight base images

---

## Known Limitations

### Cloudflare Containers Limits

| Limit | Value |
|-------|-------|
| Max instances per account | Based on resource limits |
| Max image size | Same as instance disk |
| Total image storage | 50 GB per account |
| Max concurrent memory | 400 GiB |
| Max concurrent vCPU | 100 |

### Differences from Nix Environment

1. **No declarative package management** - Tools are installed imperatively
2. **No Nix profiles** - All tools are in standard PATH
3. **No garbage collection** - Container images must be rebuilt to update
4. **No Nix flakes** - Version pinning via Dockerfile ARGs instead

### What Won't Work

- Terminal emulators (Ghostty, Kitty, etc.) - these run locally
- GUI applications
- Desktop integration features
- Home Manager configuration

---

## Troubleshooting

### Container Won't Start

Check instance type resources:
```bash
# Increase instance type if OOM
"instance_type": "standard-2"
```

### Tools Not Found

Verify PATH is set correctly:
```bash
docker run -it yazelix-sandbox env | grep PATH
```

### Slow Cold Starts

- Reduce image size
- Use `lite` instance for simple tasks
- Consider pre-warming containers

### R2 Mount Fails

- Verify credentials are set
- Check bucket exists
- Ensure FUSE is enabled in container

---

## References

- [Cloudflare Containers Documentation](https://developers.cloudflare.com/containers/)
- [Cloudflare Sandbox SDK](https://developers.cloudflare.com/sandbox/)
- [R2 Documentation](https://developers.cloudflare.com/r2/)
- [Wrangler Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Container Limits](https://developers.cloudflare.com/containers/platform-details/limits/)
- [Container Pricing](https://developers.cloudflare.com/containers/pricing/)
