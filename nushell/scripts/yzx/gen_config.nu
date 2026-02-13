#!/usr/bin/env nu
# yzx gen_config command - Generate terminal config output

use ../utils/constants.nu [SUPPORTED_TERMINALS]
use ../utils/terminal_configs.nu [
    generate_ghostty_config
    generate_wezterm_config
    generate_kitty_config
    generate_alacritty_config
    generate_foot_config
]

export def "yzx gen_config" [terminal: string] {
    let selected = ($terminal | str downcase | str trim)
    if ($selected | is-empty) {
        print "Usage: yzx gen_config <terminal>"
        return
    }

    if $selected not-in $SUPPORTED_TERMINALS {
        let supported = ($SUPPORTED_TERMINALS | str join ", ")
        error make {msg: $"Unsupported terminal: ($terminal). Supported: ($supported)"}
    }

    let default_config = "~/.config/yazelix/yazelix_default.toml" | path expand
    if not ($default_config | path exists) {
        error make {msg: $"Default config not found: ($default_config)"}
    }

    with-env {YAZELIX_CONFIG_OVERRIDE: $default_config} {
        match $selected {
            "ghostty" => (generate_ghostty_config)
            "wezterm" => (generate_wezterm_config)
            "kitty" => (generate_kitty_config)
            "alacritty" => (generate_alacritty_config)
            "foot" => (generate_foot_config)
            _ => (error make {msg: $"Unsupported terminal: ($terminal)"})
        }
    }
}
