# Yazelix Nushell Aliases

# File listing with eza
alias ls = eza --icons --group-directories-first
alias ll = eza -la --icons --group-directories-first
alias la = eza -a --icons --group-directories-first
alias lt = eza --tree --icons --group-directories-first
alias l = eza -l --icons --group-directories-first

# Navigation
alias .. = cd ..
alias ... = cd ../..
alias .... = cd ../../..
alias ..... = cd ../../../..

# Git shortcuts
alias g = git
alias gs = git status
alias ga = git add
alias gc = git commit
alias gp = git push
alias gl = git pull
alias gd = git diff
alias gb = git branch
alias gco = git checkout
alias glog = git log --oneline --graph --decorate
alias lg = lazygit

# Editor shortcuts
alias h = hx
alias e = hx
alias edit = hx
alias vi = hx
alias vim = hx

# File manager
alias y = yazi
alias fm = yazi

# Terminal multiplexer
alias z = zellij
alias zj = zellij
alias za = zellij attach
alias zl = zellij list-sessions
alias zk = zellij kill-session
alias zw = zellij web

# Better defaults
alias cat = bat
alias grep = rg
alias find = fd
alias top = btop
alias du = dust
alias df = duf

# Cloudflare Sandbox specific
alias workspace = cd /workspace
alias storage = cd /storage
alias ws = cd /workspace
alias st = cd /storage

# Quick edits
alias zc = hx ~/.config/zellij/config.kdl
alias hc = hx ~/.config/helix/config.toml
alias yc = hx ~/.config/yazi/yazi.toml
alias nc = hx ~/.config/nushell/config.nu
alias sc = hx ~/.config/starship.toml

# System info
alias ports = ss -tulpn
alias myip = curl -s https://ipinfo.io/ip
alias weather = curl -s "wttr.in?format=3"

# Yazelix functions
def yazelix-start [] {
    # Start Yazelix with the IDE layout
    zellij --layout yazelix
}

def yazelix-web [] {
    # Start Yazelix web server for remote access
    print "Starting Zellij web server on port 8082..."
    print "Create a login token with: zellij web --create-token"
    zellij web
}

def yazelix-token [] {
    # Create a new login token for web access
    zellij web --create-token
}

def yazelix-session [name?: string] {
    # Create or attach to a named Yazelix session
    let session_name = if ($name | is-empty) { "yazelix" } else { $name }
    
    # Check if session exists
    let sessions = (zellij list-sessions | lines | where { |l| $l | str contains $session_name })
    
    if ($sessions | is-empty) {
        print $"Creating new session: ($session_name)"
        zellij --session $session_name --layout yazelix
    } else {
        print $"Attaching to session: ($session_name)"
        zellij attach $session_name
    }
}

# Help command
def yazelix-help [] {
    print "Yazelix Commands:"
    print "  yazelix-start   - Start Yazelix with IDE layout"
    print "  yazelix-web     - Start Zellij web server for remote access"
    print "  yazelix-token   - Create a login token for web access"
    print "  yazelix-session - Create or attach to a named session"
    print ""
    print "Keyboard Shortcuts (in Zellij):"
    print "  Alt+n      - New pane"
    print "  Alt+h/j/k/l - Navigate panes"
    print "  Alt+f      - Toggle fullscreen"
    print "  Alt+q      - Close pane"
    print "  Alt+1-9    - Switch tabs"
    print "  Ctrl+o s   - Open share plugin (web sharing)"
}

# Print welcome message on first load
# print "Yazelix Sandbox - Type 'yazelix-help' for commands"
