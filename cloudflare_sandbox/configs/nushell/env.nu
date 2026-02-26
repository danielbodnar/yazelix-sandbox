# Yazelix Nushell Environment Configuration

# Path configuration
$env.PATH = ($env.PATH | split row (char esep) | prepend [
    "/usr/local/yazelix/bin"
    "/usr/local/bin"
    "/root/.local/bin"
] | uniq)

# Yazelix environment
$env.YAZELIX_DIR = "/workspace/yazelix"
$env.IN_YAZELIX_SHELL = "true"
$env.YAZELIX_ZJSTATUS_WASM = "/usr/local/yazelix/share/zjstatus/zjstatus.wasm"

# Editor configuration
$env.EDITOR = "hx"
$env.VISUAL = "hx"
$env.HELIX_RUNTIME = "/usr/local/yazelix/share/helix/runtime"

# Yazi configuration
$env.YAZI_CONFIG_HOME = "/root/.config/yazi"

# FZF configuration
$env.FZF_DEFAULT_COMMAND = "fd --type f --hidden --follow --exclude .git"
$env.FZF_DEFAULT_OPTS = "--height 40% --layout=reverse --border --color=bg+:#313244,bg:#1e1e2e,spinner:#f5e0dc,hl:#f38ba8 --color=fg:#cdd6f4,header:#f38ba8,info:#cba6f7,pointer:#f5e0dc --color=marker:#f5e0dc,fg+:#cdd6f4,prompt:#cba6f7,hl+:#f38ba8"

# Bat configuration
$env.BAT_THEME = "Catppuccin-mocha"
$env.BAT_STYLE = "numbers,changes,header"

# Ripgrep configuration
$env.RIPGREP_CONFIG_PATH = "/root/.config/ripgrep/config"

# Less configuration
$env.LESS = "-R -F -X"
$env.LESSCHARSET = "utf-8"

# Locale
$env.LANG = "en_US.UTF-8"
$env.LC_ALL = "en_US.UTF-8"

# Cloudflare Sandbox specific
$env.CLOUDFLARE_SANDBOX = "true"
$env.WORKSPACE_DIR = "/workspace"
$env.STORAGE_DIR = "/storage"

# Zellij web server (for remote access)
$env.ZELLIJ_WEB_PORT = "8082"

# Prompt configuration (fallback if Starship fails)
$env.PROMPT_COMMAND = { ||
    let dir = (pwd | path basename)
    let git_branch = (do { git branch --show-current } | complete | get stdout | str trim)
    if ($git_branch | is-empty) {
        $"(ansi green_bold)yazelix(ansi reset):(ansi blue_bold)($dir)(ansi reset)> "
    } else {
        $"(ansi green_bold)yazelix(ansi reset):(ansi blue_bold)($dir)(ansi reset) (ansi magenta)($git_branch)(ansi reset)> "
    }
}

$env.PROMPT_INDICATOR = ""
$env.PROMPT_INDICATOR_VI_INSERT = ": "
$env.PROMPT_INDICATOR_VI_NORMAL = "> "
$env.PROMPT_MULTILINE_INDICATOR = "::: "

# NU_LIB_DIRS and NU_PLUGIN_DIRS
$env.NU_LIB_DIRS = [
    ($nu.default-config-dir | path join 'scripts')
    ($nu.default-config-dir | path join 'completions')
]

$env.NU_PLUGIN_DIRS = [
    ($nu.default-config-dir | path join 'plugins')
]
