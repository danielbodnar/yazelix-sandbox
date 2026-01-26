/**
 * Yazelix Cloudflare Sandbox Worker
 *
 * This worker provides an API for running Yazelix (a terminal IDE combining
 * Yazi, Zellij, and Helix) in an isolated Cloudflare Sandbox environment.
 */

import { getSandbox, Sandbox } from "@cloudflare/sandbox";

export { Sandbox };

interface Env {
  Sandbox: DurableObjectNamespace;
}

// Nix profile source command
const NIX_SOURCE = "source /root/.nix-profile/etc/profile.d/nix.sh";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

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
            endpoints: [
              "GET /health - Health check",
              "GET /status - Sandbox status and tools",
              "POST /setup - Initialize Yazelix environment",
              "POST /exec - Execute a command",
              "POST /helix - Run Helix editor command",
              "POST /yazi - Run Yazi file manager command",
              "POST /zellij - Run Zellij multiplexer command",
              "GET /files - List files in workspace",
              "GET /file?path=... - Read a file",
              "POST /file - Write a file",
              "DELETE /file?path=... - Delete a file",
            ],
          });

        // Get sandbox status and available tools
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
          return await handleZellij(sandbox, request);

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
  // Check which tools are available
  const toolChecks = await Promise.all([
    sandbox.exec(`${NIX_SOURCE} && which helix || echo "not found"`),
    sandbox.exec(`${NIX_SOURCE} && which yazi || echo "not found"`),
    sandbox.exec(`${NIX_SOURCE} && which zellij || echo "not found"`),
    sandbox.exec(`${NIX_SOURCE} && which nu || echo "not found"`),
    sandbox.exec(`${NIX_SOURCE} && helix --version 2>/dev/null || echo "n/a"`),
    sandbox.exec(`${NIX_SOURCE} && yazi --version 2>/dev/null || echo "n/a"`),
    sandbox.exec(
      `${NIX_SOURCE} && zellij --version 2>/dev/null || echo "n/a"`
    ),
    sandbox.exec(`${NIX_SOURCE} && nu --version 2>/dev/null || echo "n/a"`),
    sandbox.exec("ls -la /workspace"),
  ]);

  return jsonResponse({
    status: "running",
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
  const steps: Array<{ step: string; result: { success: boolean; output: string } }> = [];

  // Step 1: Create config directories
  const mkdirResult = await sandbox.exec(
    "mkdir -p /workspace/yazelix/configs /workspace/project"
  );
  steps.push({
    step: "create_directories",
    result: { success: mkdirResult.exitCode === 0, output: mkdirResult.stdout },
  });

  // Step 2: Clone Yazelix repository (configs only)
  const cloneResult = await sandbox.exec(
    "cd /workspace/yazelix && " +
      "git clone --depth 1 --sparse https://github.com/luccahuguet/yazelix.git repo 2>&1 || true && " +
      "cd repo && git sparse-checkout set configs 2>&1 || true"
  );
  steps.push({
    step: "clone_configs",
    result: { success: true, output: cloneResult.stdout },
  });

  // Step 3: Setup Helix config
  const helixConfigResult = await sandbox.exec(`
    mkdir -p ~/.config/helix &&
    cat > ~/.config/helix/config.toml << 'EOF'
theme = "catppuccin_mocha"

[editor]
line-number = "relative"
mouse = true
cursorline = true
auto-format = true
bufferline = "multiple"
color-modes = true

[editor.cursor-shape]
insert = "bar"
normal = "block"
select = "underline"

[editor.lsp]
display-messages = true
display-inlay-hints = true

[editor.file-picker]
hidden = false

[keys.normal]
C-s = ":w"
C-q = ":q"
EOF
  `);
  steps.push({
    step: "setup_helix_config",
    result: {
      success: helixConfigResult.exitCode === 0,
      output: "Helix config created",
    },
  });

  // Step 4: Setup Yazi config
  const yaziConfigResult = await sandbox.exec(`
    mkdir -p ~/.config/yazi &&
    cat > ~/.config/yazi/yazi.toml << 'EOF'
[manager]
show_hidden = true
sort_by = "natural"
sort_sensitive = false
sort_reverse = false
sort_dir_first = true
linemode = "size"
show_symlink = true

[preview]
tab_size = 2
max_width = 600
max_height = 900

[opener]
edit = [
  { run = 'helix "$@"', block = true, for = "unix" },
]
EOF
  `);
  steps.push({
    step: "setup_yazi_config",
    result: {
      success: yaziConfigResult.exitCode === 0,
      output: "Yazi config created",
    },
  });

  // Step 5: Setup Zellij config
  const zellijConfigResult = await sandbox.exec(`
    mkdir -p ~/.config/zellij &&
    cat > ~/.config/zellij/config.kdl << 'EOF'
theme "catppuccin-mocha"
default_shell "nu"
pane_frames true
simplified_ui false
default_layout "compact"
mouse_mode true
scroll_buffer_size 10000
copy_on_select true
EOF
  `);
  steps.push({
    step: "setup_zellij_config",
    result: {
      success: zellijConfigResult.exitCode === 0,
      output: "Zellij config created",
    },
  });

  // Step 6: Verify setup
  const verifyResult = await sandbox.exec(
    `${NIX_SOURCE} && helix --version && yazi --version && zellij --version && nu --version`
  );
  steps.push({
    step: "verify_tools",
    result: { success: verifyResult.exitCode === 0, output: verifyResult.stdout },
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

  const fullCommand = `${NIX_SOURCE} && cd ${cwd} && ${command}`;
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
    case "version":
      const versionResult = await sandbox.exec(`${NIX_SOURCE} && helix --version`);
      return jsonResponse({ version: versionResult.stdout.trim() });

    case "health":
      const healthResult = await sandbox.exec(`${NIX_SOURCE} && helix --health`);
      return jsonResponse({
        health: healthResult.stdout,
        success: healthResult.exitCode === 0,
      });

    case "grammar":
      const grammarResult = await sandbox.exec(
        `${NIX_SOURCE} && helix --grammar fetch && helix --grammar build`
      );
      return jsonResponse({
        output: grammarResult.stdout,
        success: grammarResult.exitCode === 0,
      });

    case "open":
      if (!file) {
        return jsonResponse({ error: "Missing 'file' parameter" }, 400);
      }
      // For headless operation, we can open and immediately close
      // In a real terminal session, this would be interactive
      const openResult = await sandbox.exec(
        `${NIX_SOURCE} && helix --health ${file} 2>&1 || echo "File: ${file}"`
      );
      return jsonResponse({
        file,
        message: "File ready for editing",
        exists: openResult.exitCode === 0,
      });

    case "edit":
      if (!file || content === undefined) {
        return jsonResponse(
          { error: "Missing 'file' or 'content' parameter" },
          400
        );
      }
      await sandbox.writeFile(file, content);
      return jsonResponse({ file, message: "File written successfully" });

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
    case "version":
      const versionResult = await sandbox.exec(`${NIX_SOURCE} && yazi --version`);
      return jsonResponse({ version: versionResult.stdout.trim() });

    case "list":
      const listResult = await sandbox.exec(`ls -la ${path}`);
      return jsonResponse({
        path,
        contents: listResult.stdout,
        success: listResult.exitCode === 0,
      });

    case "tree":
      const treeResult = await sandbox.exec(
        `${NIX_SOURCE} && fd --type f --max-depth 3 . ${path} 2>/dev/null || find ${path} -maxdepth 3 -type f`
      );
      return jsonResponse({
        path,
        tree: treeResult.stdout,
        success: treeResult.exitCode === 0,
      });

    default:
      return jsonResponse(
        { error: "Unknown action", available: ["version", "list", "tree"] },
        400
      );
  }
}

// Handler: Zellij operations
async function handleZellij(
  sandbox: ReturnType<typeof getSandbox>,
  request: Request
): Promise<Response> {
  const body = (await request.json()) as {
    action?: string;
    session?: string;
    layout?: string;
  };
  const { action, session = "yazelix", layout } = body;

  switch (action) {
    case "version":
      const versionResult = await sandbox.exec(`${NIX_SOURCE} && zellij --version`);
      return jsonResponse({ version: versionResult.stdout.trim() });

    case "list-sessions":
      const listResult = await sandbox.exec(`${NIX_SOURCE} && zellij list-sessions 2>&1`);
      return jsonResponse({
        sessions: listResult.stdout,
        success: listResult.exitCode === 0,
      });

    case "layouts":
      const layoutsResult = await sandbox.exec(
        "ls ~/.config/zellij/layouts/ 2>/dev/null || echo 'No custom layouts'"
      );
      return jsonResponse({ layouts: layoutsResult.stdout });

    case "setup-layout":
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
            command "helix"
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

    default:
      return jsonResponse(
        {
          error: "Unknown action",
          available: ["version", "list-sessions", "layouts", "setup-layout"],
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

  const command = recursive
    ? `${NIX_SOURCE} && fd --type f . ${path} 2>/dev/null || find ${path} -type f`
    : `ls -la ${path}`;

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

  const result = await sandbox.exec(`rm -f ${path}`);

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
      "Access-Control-Allow-Origin": "*",
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
    },
  });
}
