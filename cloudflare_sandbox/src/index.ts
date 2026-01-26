/**
 * Yazelix Cloudflare Sandbox Worker
 *
 * This worker provides an API for running Yazelix (a terminal IDE combining
 * Yazi, Zellij, and Helix) in an isolated Cloudflare Sandbox environment.
 *
 * Updated to work without Nix - all tools are installed directly in the container.
 */

import { getSandbox, Sandbox, proxyToSandbox } from "@cloudflare/sandbox";

export { Sandbox };

interface Env {
  Sandbox: DurableObjectNamespace<Sandbox>;
  WORKSPACE_BUCKET: R2Bucket;
  // Environment variables for R2 mounting
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
}

// Allowed workspace base path for file operations
const WORKSPACE_BASE = "/workspace";

// CORS headers for all responses
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

// Validate that a path is within the allowed workspace
function isPathSafe(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\/+/g, "/").replace(/\/$/, "");
  const resolved = normalizedPath.startsWith("/")
    ? normalizedPath
    : `${WORKSPACE_BASE}/${normalizedPath}`;

  // Check path doesn't escape workspace via traversal
  const parts = resolved.split("/");
  let depth = 0;
  for (const part of parts) {
    if (part === "..") {
      depth--;
      if (depth < 0) return false;
    } else if (part !== "" && part !== ".") {
      depth++;
    }
  }

  return resolved.startsWith(WORKSPACE_BASE);
}

// Shell-escape a string for safe use in commands
function shellEscape(str: string): string {
  return `'${str.replace(/'/g, "'\\''")}'`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle preview URL routing first (for exposed ports like Zellij web)
    const proxyResponse = await proxyToSandbox(request, env);
    if (proxyResponse) return proxyResponse;

    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // Get or create sandbox instance
    const sandboxId = url.searchParams.get("id") || "default";
    const sandbox = getSandbox(env.Sandbox, sandboxId);

    try {
      switch (path) {
        // Health check
        case "/":
        case "/health":
          return jsonResponse({
            status: "ok",
            service: "yazelix-sandbox",
            version: "1.0.0",
            runtime: "direct-install", // No longer using Nix
            features: {
              zellijWeb: true,
              r2Storage: !!env.WORKSPACE_BUCKET,
              webTerminal: true,
            },
            endpoints: [
              "GET /health - Health check",
              "GET /status - Sandbox status and tools",
              "POST /setup - Initialize Yazelix environment",
              "POST /exec - Execute a command",
              "POST /helix - Run Helix editor command",
              "POST /yazi - Run Yazi file manager command",
              "POST /zellij - Run Zellij multiplexer command (start-web, create-token, web-status, get-url)",
              "POST /storage - Mount R2 bucket for persistent storage",
              "GET /files - List files in workspace",
              "GET /file?path=... - Read a file",
              "POST /file - Write a file",
              "DELETE /file?path=... - Delete a file",
            ],
          });

        // Get sandbox status
        case "/status":
          return await handleStatus(sandbox);

        // Initialize Yazelix environment
        case "/setup":
          if (request.method !== "POST") {
            return methodNotAllowed("POST");
          }
          return await handleSetup(sandbox);

        // Execute arbitrary command
        case "/exec":
          if (request.method !== "POST") {
            return methodNotAllowed("POST");
          }
          return await handleExec(sandbox, request);

        // Helix editor operations
        case "/helix":
          if (request.method !== "POST") {
            return methodNotAllowed("POST");
          }
          return await handleHelix(sandbox, request);

        // Yazi file manager operations
        case "/yazi":
          if (request.method !== "POST") {
            return methodNotAllowed("POST");
          }
          return await handleYazi(sandbox, request);

        // Zellij multiplexer operations
        case "/zellij":
          if (request.method !== "POST") {
            return methodNotAllowed("POST");
          }
          return await handleZellij(sandbox, request, url);

        // Storage operations (R2 mounting)
        case "/storage":
          if (request.method !== "POST") {
            return methodNotAllowed("POST");
          }
          return await handleStorage(sandbox, request, env);

        // List files
        case "/files":
          return await handleListFiles(sandbox, url);

        // File operations
        case "/file":
          if (request.method === "GET") {
            return await handleReadFile(sandbox, url);
          } else if (request.method === "POST") {
            return await handleWriteFile(sandbox, request);
          } else if (request.method === "DELETE") {
            return await handleDeleteFile(sandbox, url);
          }
          return methodNotAllowed("GET, POST, DELETE");

        default:
          return jsonResponse({ error: "Not found", path }, 404);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return jsonResponse({ error: message }, 500);
    }
  },
};

// Handler: Get sandbox status
async function handleStatus(
  sandbox: ReturnType<typeof getSandbox>
): Promise<Response> {
  // Check which tools are available (binaries are in PATH)
  const toolChecks = await Promise.all([
    sandbox.exec("which hx || echo 'not found'"),
    sandbox.exec("which yazi || echo 'not found'"),
    sandbox.exec("which zellij || echo 'not found'"),
    sandbox.exec("which nu || echo 'not found'"),
    sandbox.exec("hx --version 2>/dev/null || echo 'n/a'"),
    sandbox.exec("yazi --version 2>/dev/null || echo 'n/a'"),
    sandbox.exec("zellij --version 2>/dev/null || echo 'n/a'"),
    sandbox.exec("nu --version 2>/dev/null || echo 'n/a'"),
    sandbox.exec("ls -la /workspace"),
  ]);

  return jsonResponse({
    status: "running",
    runtime: "direct-install",
    tools: {
      helix: {
        path: toolChecks[0].stdout.trim(),
        version: toolChecks[4].stdout.trim(),
      },
      yazi: {
        path: toolChecks[1].stdout.trim(),
        version: toolChecks[5].stdout.trim(),
      },
      zellij: {
        path: toolChecks[2].stdout.trim(),
        version: toolChecks[6].stdout.trim(),
      },
      nushell: {
        path: toolChecks[3].stdout.trim(),
        version: toolChecks[7].stdout.trim(),
      },
    },
    workspace: toolChecks[8].stdout,
  });
}

// Handler: Setup Yazelix environment
async function handleSetup(
  sandbox: ReturnType<typeof getSandbox>
): Promise<Response> {
  const steps: Array<{
    step: string;
    result: { success: boolean; output: string };
  }> = [];

  // Step 1: Create workspace directories
  const mkdirResult = await sandbox.exec(
    "mkdir -p /workspace/yazelix/configs /workspace/project"
  );
  steps.push({
    step: "create_directories",
    result: {
      success: mkdirResult.exitCode === 0,
      output: mkdirResult.stdout || "Directories created",
    },
  });

  // Step 2: Clone Yazelix repository (configs only)
  const checkExistsResult = await sandbox.exec(
    "test -d /workspace/yazelix/repo/.git && echo 'exists' || echo 'not_exists'"
  );
  const alreadyCloned = checkExistsResult.stdout.trim() === "exists";

  if (alreadyCloned) {
    steps.push({
      step: "clone_configs",
      result: { success: true, output: "Repository already cloned, skipping" },
    });
  } else {
    const cloneResult = await sandbox.exec(
      "cd /workspace/yazelix && " +
        "git clone --depth 1 --sparse https://github.com/luccahuguet/yazelix.git repo 2>&1"
    );
    const cloneSuccess = cloneResult.exitCode === 0;

    if (cloneSuccess) {
      const sparseResult = await sandbox.exec(
        "cd /workspace/yazelix/repo && git sparse-checkout set configs 2>&1"
      );
      steps.push({
        step: "clone_configs",
        result: {
          success: sparseResult.exitCode === 0,
          output: cloneResult.stdout + "\n" + sparseResult.stdout,
        },
      });
    } else {
      steps.push({
        step: "clone_configs",
        result: {
          success: false,
          output: cloneResult.stdout + "\n" + cloneResult.stderr,
        },
      });
    }
  }

  // Step 3: Verify setup - tools are pre-installed in the container
  const verifyResult = await sandbox.exec(
    "hx --version && yazi --version && zellij --version && nu --version"
  );
  steps.push({
    step: "verify_tools",
    result: {
      success: verifyResult.exitCode === 0,
      output: verifyResult.stdout,
    },
  });

  return jsonResponse({
    status: "setup_complete",
    steps,
  });
}

// Handler: Execute command
async function handleExec(
  sandbox: ReturnType<typeof getSandbox>,
  request: Request
): Promise<Response> {
  const body = (await request.json()) as { command?: string; cwd?: string };
  const { command, cwd = "/workspace" } = body;

  if (!command) {
    return jsonResponse({ error: "Missing 'command' in request body" }, 400);
  }

  const fullCommand = `cd ${cwd} && ${command}`;
  const result = await sandbox.exec(fullCommand);

  return jsonResponse({
    command,
    cwd,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    success: result.exitCode === 0,
  });
}

// Handler: Helix operations
async function handleHelix(
  sandbox: ReturnType<typeof getSandbox>,
  request: Request
): Promise<Response> {
  const body = (await request.json()) as {
    action?: string;
    file?: string;
    content?: string;
  };
  const { action, file, content } = body;

  switch (action) {
    case "version": {
      const versionResult = await sandbox.exec("hx --version");
      return jsonResponse({ version: versionResult.stdout.trim() });
    }

    case "health": {
      const healthResult = await sandbox.exec("hx --health");
      return jsonResponse({
        health: healthResult.stdout,
        success: healthResult.exitCode === 0,
      });
    }

    case "grammar": {
      const grammarResult = await sandbox.exec(
        "hx --grammar fetch && hx --grammar build"
      );
      return jsonResponse({
        output: grammarResult.stdout,
        success: grammarResult.exitCode === 0,
      });
    }

    case "open": {
      if (!file) {
        return jsonResponse({ error: "Missing 'file' parameter" }, 400);
      }
      // Validate path is within workspace
      if (!isPathSafe(file)) {
        return jsonResponse({ error: "Path must be within /workspace" }, 400);
      }
      const openResult = await sandbox.exec(
        `test -f ${shellEscape(file)} && echo "exists" || echo "not_found"`
      );
      const fileExists = openResult.stdout.trim() === "exists";
      return jsonResponse({
        file,
        message: fileExists
          ? "File exists and ready for editing"
          : "File does not exist",
        exists: fileExists,
      });
    }

    case "edit": {
      if (!file || content === undefined) {
        return jsonResponse(
          { error: "Missing 'file' or 'content' parameter" },
          400
        );
      }
      // Validate path is within workspace
      if (!isPathSafe(file)) {
        return jsonResponse(
          { error: "Path must be within /workspace and cannot contain path traversal" },
          400
        );
      }
      await sandbox.writeFile(file, content);
      return jsonResponse({ file, message: "File written successfully" });
    }

    default:
      return jsonResponse(
        {
          error: "Unknown action",
          available: ["version", "health", "grammar", "open", "edit"],
        },
        400
      );
  }
}

// Handler: Yazi operations
async function handleYazi(
  sandbox: ReturnType<typeof getSandbox>,
  request: Request
): Promise<Response> {
  const body = (await request.json()) as { action?: string; path?: string };
  const { action, path = "/workspace" } = body;

  switch (action) {
    case "version": {
      const versionResult = await sandbox.exec("yazi --version");
      return jsonResponse({ version: versionResult.stdout.trim() });
    }

    case "list": {
      // Validate path is within workspace
      if (!isPathSafe(path)) {
        return jsonResponse(
          { error: "Path must be within /workspace and cannot contain path traversal" },
          400
        );
      }
      const listResult = await sandbox.exec(`ls -la ${shellEscape(path)}`);
      return jsonResponse({
        path,
        contents: listResult.stdout,
        success: listResult.exitCode === 0,
      });
    }

    case "tree": {
      // Validate path is within workspace
      if (!isPathSafe(path)) {
        return jsonResponse(
          { error: "Path must be within /workspace and cannot contain path traversal" },
          400
        );
      }
      const escapedPath = shellEscape(path);
      const treeResult = await sandbox.exec(
        `fd --type f --max-depth 3 . ${escapedPath} 2>/dev/null || find ${escapedPath} -maxdepth 3 -type f`
      );
      return jsonResponse({
        path,
        tree: treeResult.stdout,
        success: treeResult.exitCode === 0,
      });
    }

    default:
      return jsonResponse(
        { error: "Unknown action", available: ["version", "list", "tree"] },
        400
      );
  }
}

// Handler: Zellij operations (including web server management)
async function handleZellij(
  sandbox: ReturnType<typeof getSandbox>,
  request: Request,
  url: URL
): Promise<Response> {
  const body = (await request.json()) as {
    action?: string;
    session?: string;
    layout?: string;
  };
  const { action, session = "yazelix", layout = "yazelix" } = body;
  const { hostname } = url;

  switch (action) {
    case "version": {
      const versionResult = await sandbox.exec("zellij --version");
      return jsonResponse({ version: versionResult.stdout.trim() });
    }

    case "list-sessions": {
      const listResult = await sandbox.exec("zellij list-sessions 2>&1");
      return jsonResponse({
        sessions: listResult.stdout,
        success: listResult.exitCode === 0,
      });
    }

    case "layouts": {
      const layoutsResult = await sandbox.exec(
        "ls ~/.config/zellij/layouts/ 2>/dev/null || echo 'No custom layouts'"
      );
      return jsonResponse({ layouts: layoutsResult.stdout });
    }

    case "setup-layout": {
      // Create a Yazelix-style layout
      const setupResult = await sandbox.exec(`
        mkdir -p ~/.config/zellij/layouts &&
        cat > ~/.config/zellij/layouts/yazelix.kdl << 'EOF'
layout {
    pane split_direction="vertical" {
        pane size="20%" {
            command "yazi"
        }
        pane size="80%" {
            command "hx"
            args "."
        }
    }
}
EOF
      `);
      return jsonResponse({
        message: "Yazelix layout created",
        success: setupResult.exitCode === 0,
      });
    }

    // Start Zellij with web server enabled
    case "start-web": {
      // Step 1: Start Zellij web server bound to localhost
      // (Zellij requires SSL for non-loopback IPs)
      const zellijCheck = await sandbox.exec(
        "pgrep -x zellij > /dev/null && echo 'running' || echo 'stopped'"
      );
      
      if (zellijCheck.stdout.trim() !== "running") {
        // Start Zellij web server on localhost
        await sandbox.exec(
          "nohup zellij web --ip 127.0.0.1 --port 8082 > /workspace/yazelix/zellij-web.log 2>&1 &"
        );
        // Wait for startup
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Step 2: Set up the HTTP proxy to forward from 0.0.0.0:8083 to 127.0.0.1:8082
      const proxyCheck = await sandbox.exec(
        "pgrep -f 'node.*proxy' > /dev/null && echo 'running' || echo 'stopped'"
      );

      if (proxyCheck.stdout.trim() !== "running") {
        // Create proxy script
        const proxyScript = `import http from 'http';
import httpProxy from 'http-proxy';

const proxy = httpProxy.createProxyServer({});

const server = http.createServer((req, res) => {
  proxy.web(req, res, { target: 'http://127.0.0.1:8082' });
});

server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head, { target: 'ws://127.0.0.1:8082' });
});

server.listen(8083, '0.0.0.0', () => {
  console.log('Proxy listening on 0.0.0.0:8083 -> 127.0.0.1:8082');
});
`;
        await sandbox.writeFile("/workspace/yazelix/proxy.mjs", proxyScript);
        
        // Install http-proxy if needed and start the proxy
        await sandbox.exec(
          "cd /workspace/yazelix && npm init -y 2>/dev/null; npm install http-proxy 2>/dev/null; nohup node proxy.mjs > proxy.log 2>&1 &"
        );
        // Wait for proxy startup
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Step 3: Expose the proxy port
      let webUrl = "";
      try {
        const exposed = await sandbox.exposePort(8083, {
          hostname,
          name: "zellij-web-proxy",
        });
        webUrl = exposed.url || "";
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (message.includes("already exposed")) {
          webUrl = `https://8083-default-*.${hostname} (already exposed)`;
        } else {
          webUrl = `Failed to expose port: ${message}`;
        }
      }

      // Verify everything is running
      const statusCheck = await sandbox.exec(
        "echo 'Zellij: '; pgrep -x zellij && echo 'running' || echo 'not running'; " +
        "echo 'Proxy: '; pgrep -f 'node.*proxy' && echo 'running' || echo 'not running'; " +
        "echo 'Port 8082: '; ss -tlnp | grep 8082 || echo 'not listening'; " +
        "echo 'Port 8083: '; ss -tlnp | grep 8083 || echo 'not listening'"
      );

      const isLocalDev = hostname === "localhost" || hostname.startsWith("localhost:") || hostname.startsWith("127.0.0.1");
      
      const response: Record<string, unknown> = {
        message: "Zellij web session started",
        session,
        layout,
        webPort: 8083,
        internalPort: 8082,
        webUrl,
        status: statusCheck.stdout,
        hint: "Use 'create-token' to generate an authentication token for the web interface.",
        success: true,
      };
      
      if (isLocalDev) {
        response.localDev = {
          note: "In local development, use the Docker-mapped port to access the web interface.",
          howToFind: "Run: docker container ls --format '{{.Ports}}' | grep 8083",
          accessUrl: "http://localhost:<mapped-port>/",
          example: "If docker shows '0.0.0.0:32943->8083/tcp', use http://localhost:32943/",
        };
      }
      
      return jsonResponse(response);
    }

    // Create an authentication token for web access
    case "create-token": {
      const tokenResult = await sandbox.exec(
        "zellij web --create-token 2>&1 | tail -1"
      );

      if (tokenResult.exitCode !== 0) {
        return jsonResponse(
          {
            error: "Failed to create token",
            output: tokenResult.stdout + tokenResult.stderr,
          },
          500
        );
      }

      const token = tokenResult.stdout.trim();

      // Save token to a file for reference
      await sandbox.exec(
        `echo "${token}" > /workspace/yazelix/.web_token && chmod 600 /workspace/yazelix/.web_token`
      );

      return jsonResponse({
        token,
        message:
          "Token created successfully. Use this token to authenticate to the web interface.",
        hint: "Add ?token=<token> to the web URL or use the web UI to enter it.",
        savedTo: "/workspace/yazelix/.web_token",
      });
    }

    // Get web server status
    case "web-status": {
      // Check if Zellij web server is running
      const zellijCheck = await sandbox.exec(
        "pgrep -x zellij > /dev/null && echo 'running' || echo 'stopped'"
      );
      const zellijRunning = zellijCheck.stdout.trim() === "running";

      // Check if proxy is running
      const proxyCheck = await sandbox.exec(
        "pgrep -f 'node.*proxy' > /dev/null && echo 'running' || echo 'stopped'"
      );
      const proxyRunning = proxyCheck.stdout.trim() === "running";

      // Test if we can actually connect to the services
      const connectivityCheck = await sandbox.exec(
        "curl -sf http://127.0.0.1:8082/ > /dev/null && echo 'zellij:ok' || echo 'zellij:fail'; " +
        "curl -sf http://0.0.0.0:8083/ > /dev/null && echo 'proxy:ok' || echo 'proxy:fail'"
      );
      const zellijConnectable = connectivityCheck.stdout.includes("zellij:ok");
      const proxyConnectable = connectivityCheck.stdout.includes("proxy:ok");

      // Check for saved token
      const tokenCheck = await sandbox.exec(
        "test -f /workspace/yazelix/.web_token && echo 'token_exists' || echo 'no_token'"
      );
      const hasToken = tokenCheck.stdout.trim() === "token_exists";

      const isReady = zellijRunning && proxyRunning && zellijConnectable && proxyConnectable;

      return jsonResponse({
        zellijRunning,
        zellijConnectable,
        proxyRunning,
        proxyConnectable,
        internalPort: 8082,
        externalPort: 8083,
        hasAuthToken: hasToken,
        status: isReady ? "ready" : "not_ready",
        hint: isReady 
          ? "Use 'get-url' to get the access URL and 'create-token' for authentication."
          : "Run 'start-web' to start the Zellij web server.",
      });
    }

    // Get the web access URL
    case "get-url": {
      const isLocalDev = hostname === "localhost" || hostname.startsWith("localhost:") || hostname.startsWith("127.0.0.1");
      
      try {
        // Try to expose the proxy port (8083) which forwards to Zellij web (127.0.0.1:8082)
        const exposed = await sandbox.exposePort(8083, {
          hostname,
          name: "zellij-web-proxy",
        });
        
        if (isLocalDev) {
          return jsonResponse({
            webUrl: exposed.url,
            port: 8083,
            containerPort: 8083,
            localDevNote: "In local development, the preview URL format won't work directly. Use 'docker container ls' to find the host-mapped port for container port 8083, then access http://localhost:<mapped-port>/",
            hint: "You'll need an auth token to access. Use action 'create-token' to generate one.",
            example: "docker container ls --format '{{.Ports}}' | grep 8083",
          });
        }
        
        return jsonResponse({
          webUrl: exposed.url,
          port: 8083,
          hint: "You'll need an auth token to access. Use action 'create-token' to generate one.",
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        // If already exposed, try to return a constructed URL
        if (message.includes("already exposed")) {
          if (isLocalDev) {
            return jsonResponse({
              webUrl: `http://localhost:8083 (via Docker mapped port)`,
              port: 8083,
              containerPort: 8083,
              localDevNote: "Port already exposed. In local dev, find the host-mapped port with: docker container ls --format '{{.Ports}}' | grep 8083",
              hint: "Port was already exposed. You'll need an auth token to access.",
            });
          }
          return jsonResponse({
            webUrl: `https://8083-${hostname}`,
            port: 8083,
            hint: "Port was already exposed. You'll need an auth token to access.",
            note: "URL format may vary - check the Cloudflare dashboard for the exact URL.",
          });
        }
        return jsonResponse(
          {
            error: "Failed to get web URL",
            message,
            hint: "Make sure the Zellij web server is running (use action 'start-web' first)",
          },
          500
        );
      }
    }

    // Kill a Zellij session
    case "kill-session": {
      const killResult = await sandbox.exec(
        `zellij kill-session ${shellEscape(session)} 2>&1`
      );
      return jsonResponse({
        message: `Session '${session}' killed`,
        success: killResult.exitCode === 0,
        output: killResult.stdout + killResult.stderr,
      });
    }

    default:
      return jsonResponse(
        {
          error: "Unknown action",
          available: [
            "version",
            "list-sessions",
            "layouts",
            "setup-layout",
            "start-web",
            "create-token",
            "web-status",
            "get-url",
            "kill-session",
          ],
        },
        400
      );
  }
}

// Handler: Storage operations (R2 mounting)
async function handleStorage(
  sandbox: ReturnType<typeof getSandbox>,
  request: Request,
  env: Env
): Promise<Response> {
  const body = (await request.json()) as {
    action?: string;
    bucket?: string;
    mountPath?: string;
    readOnly?: boolean;
  };
  const {
    action,
    bucket = "yazelix-workspaces",
    mountPath = "/storage",
    readOnly = false,
  } = body;

  switch (action) {
    case "mount": {
      // Check if R2 credentials are configured
      if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
        return jsonResponse(
          {
            error: "R2 credentials not configured",
            hint: "Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY secrets",
          },
          400
        );
      }

      try {
        // Mount the R2 bucket using the Sandbox SDK
        await sandbox.mountBucket(bucket, mountPath, {
          endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: env.R2_ACCESS_KEY_ID,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          },
          provider: "r2",
          readOnly,
        });

        // Verify mount
        const verifyResult = await sandbox.exec(`ls -la ${shellEscape(mountPath)}`);

        return jsonResponse({
          message: `R2 bucket '${bucket}' mounted at '${mountPath}'`,
          bucket,
          mountPath,
          readOnly,
          success: true,
          contents: verifyResult.stdout,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return jsonResponse(
          {
            error: "Failed to mount R2 bucket",
            message,
            bucket,
            mountPath,
          },
          500
        );
      }
    }

    case "unmount": {
      try {
        await sandbox.unmountBucket(mountPath);
        return jsonResponse({
          message: `Unmounted '${mountPath}'`,
          mountPath,
          success: true,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return jsonResponse(
          {
            error: "Failed to unmount",
            message,
            mountPath,
          },
          500
        );
      }
    }

    case "status": {
      // Check current mounts
      const mountResult = await sandbox.exec("mount | grep fuse || echo 'No FUSE mounts'");
      const dfResult = await sandbox.exec(`df -h ${shellEscape(mountPath)} 2>/dev/null || echo 'Mount not found'`);

      return jsonResponse({
        mounts: mountResult.stdout,
        diskUsage: dfResult.stdout,
        mountPath,
      });
    }

    case "list": {
      // List contents of mounted storage
      const listResult = await sandbox.exec(`ls -la ${shellEscape(mountPath)} 2>&1`);
      return jsonResponse({
        path: mountPath,
        contents: listResult.stdout,
        success: listResult.exitCode === 0,
      });
    }

    default:
      return jsonResponse(
        {
          error: "Unknown action",
          available: ["mount", "unmount", "status", "list"],
        },
        400
      );
  }
}

// Handler: List files
async function handleListFiles(
  sandbox: ReturnType<typeof getSandbox>,
  url: URL
): Promise<Response> {
  const path = url.searchParams.get("path") || "/workspace";
  const recursive = url.searchParams.get("recursive") === "true";

  // Validate path is within workspace
  if (!isPathSafe(path)) {
    return jsonResponse(
      { error: "Path must be within /workspace and cannot contain path traversal" },
      400
    );
  }

  const escapedPath = shellEscape(path);
  const command = recursive
    ? `fd --type f . ${escapedPath} 2>/dev/null || find ${escapedPath} -type f`
    : `ls -la ${escapedPath}`;

  const result = await sandbox.exec(command);

  return jsonResponse({
    path,
    recursive,
    files: result.stdout,
    success: result.exitCode === 0,
  });
}

// Handler: Read file
async function handleReadFile(
  sandbox: ReturnType<typeof getSandbox>,
  url: URL
): Promise<Response> {
  const path = url.searchParams.get("path");

  if (!path) {
    return jsonResponse({ error: "Missing 'path' query parameter" }, 400);
  }

  // Validate path is within workspace
  if (!isPathSafe(path)) {
    return jsonResponse(
      { error: "Path must be within /workspace and cannot contain path traversal" },
      400
    );
  }

  try {
    const content = await sandbox.readFile(path);
    return jsonResponse({ path, content, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message, path }, 404);
  }
}

// Handler: Write file
async function handleWriteFile(
  sandbox: ReturnType<typeof getSandbox>,
  request: Request
): Promise<Response> {
  const body = (await request.json()) as { path?: string; content?: string };
  const { path, content } = body;

  if (!path || content === undefined) {
    return jsonResponse(
      { error: "Missing 'path' or 'content' in request body" },
      400
    );
  }

  // Validate path is within workspace
  if (!isPathSafe(path)) {
    return jsonResponse(
      { error: "Path must be within /workspace and cannot contain path traversal" },
      400
    );
  }

  await sandbox.writeFile(path, content);

  return jsonResponse({ path, message: "File written successfully" });
}

// Handler: Delete file
async function handleDeleteFile(
  sandbox: ReturnType<typeof getSandbox>,
  url: URL
): Promise<Response> {
  const path = url.searchParams.get("path");

  if (!path) {
    return jsonResponse({ error: "Missing 'path' query parameter" }, 400);
  }

  // Validate path is within workspace to prevent path traversal attacks
  if (!isPathSafe(path)) {
    return jsonResponse(
      {
        error: "Path must be within /workspace and cannot contain path traversal",
      },
      400
    );
  }

  // Use shell-escaped path with -- to prevent flag injection
  const result = await sandbox.exec(`rm -f -- ${shellEscape(path)}`);

  return jsonResponse({
    path,
    deleted: result.exitCode === 0,
    message: result.exitCode === 0 ? "File deleted" : result.stderr,
  });
}

// Utility: JSON response
function jsonResponse(data: object, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

// Utility: Method not allowed response
function methodNotAllowed(allowed: string): Response {
  return new Response(JSON.stringify({ error: "Method not allowed", allowed }), {
    status: 405,
    headers: {
      "Content-Type": "application/json",
      Allow: allowed,
      ...CORS_HEADERS,
    },
  });
}
