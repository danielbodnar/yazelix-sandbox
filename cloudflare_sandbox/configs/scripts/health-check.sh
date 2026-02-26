#!/bin/bash
# Health Check Script for Yazelix Sandbox
# Used by container orchestration to verify the sandbox is healthy

set -e

# Check if critical tools are available
check_tools() {
	local tools=("hx" "zellij" "yazi" "nu")
	local failed=0

	for tool in "${tools[@]}"; do
		if ! command -v "$tool" &>/dev/null; then
			echo "FAIL: $tool not found"
			failed=1
		else
			echo "OK: $tool"
		fi
	done

	return $failed
}

# Check if Zellij web server is responding (if enabled)
check_web_server() {
	local port="${ZELLIJ_WEB_PORT:-8082}"

	if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port" 2>/dev/null | grep -q "^[234]"; then
		echo "OK: Zellij web server responding on port $port"
		return 0
	else
		echo "INFO: Zellij web server not active on port $port"
		return 0 # Not a failure, web server might not be started
	fi
}

# Check workspace directory
check_workspace() {
	if [ -d "/workspace" ] && [ -w "/workspace" ]; then
		echo "OK: /workspace is writable"
		return 0
	else
		echo "FAIL: /workspace not accessible"
		return 1
	fi
}

# Check storage mount (if configured)
check_storage() {
	if [ -d "/storage" ]; then
		if mountpoint -q "/storage" 2>/dev/null; then
			echo "OK: /storage is mounted"
		else
			echo "INFO: /storage exists but not mounted"
		fi
	else
		echo "INFO: /storage not configured"
	fi
	return 0
}

# Main health check
main() {
	echo "=== Yazelix Sandbox Health Check ==="
	echo ""

	local exit_code=0

	echo "-- Tools --"
	check_tools || exit_code=1
	echo ""

	echo "-- Workspace --"
	check_workspace || exit_code=1
	echo ""

	echo "-- Storage --"
	check_storage
	echo ""

	echo "-- Web Server --"
	check_web_server
	echo ""

	if [ $exit_code -eq 0 ]; then
		echo "=== Health Check: PASSED ==="
	else
		echo "=== Health Check: FAILED ==="
	fi

	exit $exit_code
}

main "$@"
