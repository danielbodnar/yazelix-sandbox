# Yazelix Nushell Configuration
# https://www.nushell.sh/book/configuration.html

# Environment configuration
$env.config = {
    show_banner: false
    edit_mode: emacs
    
    shell_integration: {
        osc2: true
        osc7: true
        osc8: true
        osc9_9: false
        osc133: true
        osc633: true
        reset_application_mode: true
    }
    
    cursor_shape: {
        emacs: line
        vi_insert: line
        vi_normal: block
    }
    
    table: {
        mode: rounded
        index_mode: always
        show_empty: true
        padding: { left: 1, right: 1 }
        trim: {
            methodology: wrapping
            wrapping_try_keep_words: true
            truncating_suffix: "..."
        }
        header_on_separator: false
    }
    
    error_style: "fancy"
    
    completions: {
        case_sensitive: false
        quick: true
        partial: true
        algorithm: "prefix"
        use_ls_colors: true
    }
    
    filesize: {
        metric: false
        format: "auto"
    }
    
    history: {
        max_size: 100000
        sync_on_enter: true
        file_format: "sqlite"
        isolation: false
    }
    
    keybindings: [
        {
            name: completion_menu
            modifier: none
            keycode: tab
            mode: [emacs vi_normal vi_insert]
            event: {
                until: [
                    { send: menu name: completion_menu }
                    { send: menunext }
                    { edit: complete }
                ]
            }
        }
        {
            name: history_menu
            modifier: control
            keycode: char_r
            mode: [emacs, vi_insert, vi_normal]
            event: { send: menu name: history_menu }
        }
        {
            name: help_menu
            modifier: none
            keycode: f1
            mode: [emacs, vi_insert, vi_normal]
            event: { send: menu name: help_menu }
        }
        {
            name: escape
            modifier: none
            keycode: escape
            mode: [emacs, vi_normal, vi_insert]
            event: { send: esc }
        }
        {
            name: cancel_command
            modifier: control
            keycode: char_c
            mode: [emacs, vi_normal, vi_insert]
            event: { send: ctrlc }
        }
        {
            name: clear_screen
            modifier: control
            keycode: char_l
            mode: [emacs, vi_normal, vi_insert]
            event: { send: clearscreen }
        }
        {
            name: open_editor
            modifier: control
            keycode: char_o
            mode: [emacs, vi_normal, vi_insert]
            event: { send: openeditor }
        }
    ]
    
    menus: [
        {
            name: completion_menu
            only_buffer_difference: false
            marker: "| "
            type: {
                layout: columnar
                columns: 4
                col_width: 20
                col_padding: 2
            }
            style: {
                text: green
                selected_text: { attr: r }
                description_text: yellow
                match_text: { attr: u }
                selected_match_text: { attr: ur }
            }
        }
        {
            name: history_menu
            only_buffer_difference: true
            marker: "? "
            type: {
                layout: list
                page_size: 10
            }
            style: {
                text: green
                selected_text: green_reverse
                description_text: yellow
            }
        }
        {
            name: help_menu
            only_buffer_difference: true
            marker: "? "
            type: {
                layout: description
                columns: 4
                col_width: 20
                col_padding: 2
                selection_rows: 4
                description_rows: 10
            }
            style: {
                text: green
                selected_text: green_reverse
                description_text: yellow
            }
        }
    ]
    
    hooks: {
        pre_prompt: [{ ||
            # Update terminal title before prompt
            if (term size).columns > 0 {
                print -n $"\e]0;yazelix: (pwd | path basename)\a"
            }
        }]
        pre_execution: [{ ||
            # Hook before command execution
        }]
        env_change: {
            PWD: [{ |before, after|
                # Update zoxide database on directory change
                if ($env.PATH | split row (char esep) | any { |p| ($p | path join "zoxide") | path exists }) {
                    zoxide add $after
                }
            }]
        }
        display_output: "if (term size).columns >= 100 { table -e } else { table }"
        command_not_found: { ||
            null
        }
    }
    
    datetime_format: {
        normal: "%Y-%m-%d %H:%M:%S"
        table: "%Y-%m-%d %H:%M"
    }
    
    explore: {
        status_bar_background: { fg: "#1D1F21", bg: "#C4C9C6" }
        command_bar_text: { fg: "#C4C9C6" }
        highlight: { fg: "black", bg: "yellow" }
        status: {
            error: { fg: "white", bg: "red" }
            warn: {}
            info: {}
        }
        table: {
            split_line: { fg: "#404040" }
            selected_cell: { bg: light_blue }
            selected_row: {}
            selected_column: {}
        }
    }
}

# Source additional configurations
source ~/.config/nushell/env.nu
source ~/.config/nushell/aliases.nu

# Initialize zoxide (generated at container build time)
source ~/.config/nushell/zoxide.nu

# Initialize Starship prompt (generated at container build time)
use ~/.config/nushell/starship.nu
