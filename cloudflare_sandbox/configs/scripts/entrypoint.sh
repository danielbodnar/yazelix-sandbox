#!/bin/bash
# Yazelix Sandbox Entrypoint Script
# IMPORTANT: This script MUST end with starting the Cloudflare Sandbox container-server
# The container-server provides the API that the SDK uses to control the container

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
	echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
	echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
	echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
	echo -e "${RED}[ERROR]${NC} $1"
}

# Initialize environment
init_environment() {
	log_info "Initializing Yazelix environment..."

	# Ensure directories exist
	mkdir -p /workspace/yazelix
	mkdir -p /workspace/project
	mkdir -p /storage 2>/dev/null || true
	mkdir -p /root/.local/share/zellij
	mkdir -p /root/.local/share/helix
	mkdir -p /root/.local/share/yazi

	# Set permissions
	chmod -R 755 /usr/local/yazelix/bin 2>/dev/null || true

	log_success "Environment initialized"
}

# Generate dynamic configs (zoxide, starship)
generate_dynamic_configs() {
	log_info "Generating dynamic configurations..."

	# Generate zoxide init for Nushell
	if command -v zoxide &>/dev/null; then
		zoxide init nushell >/root/.config/nushell/zoxide.nu 2>/dev/null || true
		log_success "Generated zoxide configuration"
	else
		log_warn "zoxide not found, skipping"
		echo "# zoxide not available" >/root/.config/nushell/zoxide.nu
	fi

	# Generate Starship init for Nushell
	if command -v starship &>/dev/null; then
		starship init nu >/root/.config/nushell/starship.nu 2>/dev/null || true
		log_success "Generated Starship configuration"
	else
		log_warn "Starship not found, skipping"
		echo "# starship not available" >/root/.config/nushell/starship.nu
	fi
}

# Main entrypoint logic
main() {
	log_info "=== Yazelix Sandbox Starting ==="
	log_info "Yazelix Version: ${YAZELIX_VERSION:-1.0.0}"

	# Initialize environment
	init_environment

	# Generate dynamic configs on first run or if requested
	if [ ! -f /root/.config/nushell/zoxide.nu ] || [ "${YAZELIX_REGEN_CONFIGS:-false}" = "true" ]; then
		generate_dynamic_configs
	fi

	log_success "Yazelix environment ready"
	log_info "Starting Cloudflare Sandbox container-server..."

	# CRITICAL: Must end with starting the Cloudflare Sandbox container-server
	# This provides the API that the SDK uses to control the container
	# All other services (Zellij, etc.) should be started via SDK exec() calls
	exec bun /container-server/dist/index.js
}

# Run main
main
