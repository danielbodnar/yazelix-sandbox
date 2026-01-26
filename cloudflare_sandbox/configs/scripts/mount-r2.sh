#!/bin/bash
# R2 Bucket Mount Script for Yazelix Sandbox
# This script mounts an R2 bucket to /storage using FUSE
#
# The actual mounting is handled by the Cloudflare Sandbox SDK's
# mountBucket() method, but this script can be used for manual
# mounting or debugging.

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Default mount point
MOUNT_POINT="${STORAGE_DIR:-/storage}"

# Check if required environment variables are set
check_credentials() {
	if [ -z "$R2_ACCESS_KEY_ID" ] || [ -z "$R2_SECRET_ACCESS_KEY" ]; then
		log_error "R2 credentials not set"
		log_info "Required environment variables:"
		log_info "  R2_ACCESS_KEY_ID"
		log_info "  R2_SECRET_ACCESS_KEY"
		log_info "  R2_ENDPOINT (optional, defaults to Cloudflare R2)"
		log_info "  R2_BUCKET_NAME"
		return 1
	fi

	if [ -z "$R2_BUCKET_NAME" ]; then
		log_error "R2_BUCKET_NAME not set"
		return 1
	fi

	return 0
}

# Create mount point if it doesn't exist
create_mount_point() {
	if [ ! -d "$MOUNT_POINT" ]; then
		log_info "Creating mount point: $MOUNT_POINT"
		mkdir -p "$MOUNT_POINT"
	fi
}

# Check if already mounted
check_mounted() {
	if mountpoint -q "$MOUNT_POINT" 2>/dev/null; then
		log_warn "$MOUNT_POINT is already mounted"
		return 0
	fi
	return 1
}

# Mount using s3fs (if available)
mount_s3fs() {
	if ! command -v s3fs &>/dev/null; then
		log_error "s3fs not installed"
		return 1
	fi

	log_info "Mounting with s3fs..."

	# Create credentials file
	echo "$R2_ACCESS_KEY_ID:$R2_SECRET_ACCESS_KEY" >/tmp/s3fs_creds
	chmod 600 /tmp/s3fs_creds

	# Determine endpoint
	local endpoint="${R2_ENDPOINT:-https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com}"

	# Mount
	s3fs "$R2_BUCKET_NAME" "$MOUNT_POINT" \
		-o passwd_file=/tmp/s3fs_creds \
		-o url="$endpoint" \
		-o use_path_request_style \
		-o allow_other \
		-o umask=0022 \
		-o mp_umask=0022 \
		-o nonempty \
		-o retries=3

	# Clean up credentials file
	rm -f /tmp/s3fs_creds

	log_success "Mounted $R2_BUCKET_NAME to $MOUNT_POINT"
}

# Mount using tigrisfs (preferred for Cloudflare)
mount_tigrisfs() {
	if ! command -v tigrisfs &>/dev/null; then
		log_warn "tigrisfs not installed, falling back to s3fs"
		return 1
	fi

	log_info "Mounting with tigrisfs..."

	local endpoint="${R2_ENDPOINT:-https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com}"

	tigrisfs mount "$R2_BUCKET_NAME" "$MOUNT_POINT" \
		--access-key "$R2_ACCESS_KEY_ID" \
		--secret-key "$R2_SECRET_ACCESS_KEY" \
		--endpoint "$endpoint" \
		--region auto

	log_success "Mounted $R2_BUCKET_NAME to $MOUNT_POINT with tigrisfs"
}

# Unmount
unmount() {
	if ! mountpoint -q "$MOUNT_POINT" 2>/dev/null; then
		log_warn "$MOUNT_POINT is not mounted"
		return 0
	fi

	log_info "Unmounting $MOUNT_POINT..."
	fusermount -u "$MOUNT_POINT" || umount "$MOUNT_POINT"
	log_success "Unmounted $MOUNT_POINT"
}

# Status
status() {
	echo "=== R2 Mount Status ==="
	echo "Mount point: $MOUNT_POINT"

	if mountpoint -q "$MOUNT_POINT" 2>/dev/null; then
		echo "Status: MOUNTED"
		echo ""
		echo "Contents:"
		ls -la "$MOUNT_POINT" 2>/dev/null | head -20
	else
		echo "Status: NOT MOUNTED"
	fi

	echo ""
	echo "Environment:"
	echo "  R2_BUCKET_NAME: ${R2_BUCKET_NAME:-<not set>}"
	echo "  R2_ENDPOINT: ${R2_ENDPOINT:-<default>}"
	echo "  R2_ACCOUNT_ID: ${R2_ACCOUNT_ID:-<not set>}"
	echo "  R2_ACCESS_KEY_ID: ${R2_ACCESS_KEY_ID:+<set>}${R2_ACCESS_KEY_ID:-<not set>}"
}

# Main
main() {
	case "${1:-mount}" in
	mount)
		check_credentials || exit 1
		check_mounted && exit 0
		create_mount_point
		mount_tigrisfs || mount_s3fs
		;;
	unmount | umount)
		unmount
		;;
	status)
		status
		;;
	help | --help | -h)
		echo "Usage: $0 [mount|unmount|status|help]"
		echo ""
		echo "Commands:"
		echo "  mount    - Mount R2 bucket to /storage (default)"
		echo "  unmount  - Unmount the bucket"
		echo "  status   - Show mount status"
		echo "  help     - Show this help"
		echo ""
		echo "Environment variables:"
		echo "  R2_BUCKET_NAME      - Name of the R2 bucket"
		echo "  R2_ACCESS_KEY_ID    - R2 access key ID"
		echo "  R2_SECRET_ACCESS_KEY - R2 secret access key"
		echo "  R2_ACCOUNT_ID       - Cloudflare account ID"
		echo "  R2_ENDPOINT         - Custom endpoint (optional)"
		echo "  STORAGE_DIR         - Mount point (default: /storage)"
		;;
	*)
		log_error "Unknown command: $1"
		echo "Use '$0 help' for usage information"
		exit 1
		;;
	esac
}

main "$@"
