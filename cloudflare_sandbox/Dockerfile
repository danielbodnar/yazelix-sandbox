# Yazelix Sandbox Container
# Based on Cloudflare Sandbox with essential development tools

FROM docker.io/cloudflare/sandbox:0.7.5

# Required during local development to access exposed ports
EXPOSE 8080

# Install essential system packages
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    git \
    unzip \
    xz-utils \
    build-essential \
    ca-certificates \
    gnupg \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Install Nix package manager (single-user mode for container)
# Pin to specific version with SHA256 checksum for supply chain security
ARG NIX_VERSION=2.24.10
ARG NIX_SHA256=0f72926b1c55d787fd1e1d3a23de65da5cf7638c3fb7772500c55112bc99b799
RUN curl -fsSL -o /tmp/nix-install.sh "https://releases.nixos.org/nix/nix-${NIX_VERSION}/install" && \
    echo "${NIX_SHA256}  /tmp/nix-install.sh" | sha256sum -c - && \
    chmod +x /tmp/nix-install.sh && \
    /tmp/nix-install.sh --no-daemon && \
    rm /tmp/nix-install.sh

# Set up Nix environment
ENV PATH="/root/.nix-profile/bin:/nix/var/nix/profiles/default/bin:$PATH"
ENV NIX_PATH="nixpkgs=channel:nixos-unstable"

# Install core Yazelix tools via Nix
RUN . /root/.nix-profile/etc/profile.d/nix.sh && \
    nix-channel --add https://nixos.org/channels/nixos-unstable nixpkgs && \
    nix-channel --update && \
    nix-env -iA nixpkgs.helix \
            nixpkgs.yazi \
            nixpkgs.zellij \
            nixpkgs.nushell \
            nixpkgs.starship \
            nixpkgs.zoxide \
            nixpkgs.ripgrep \
            nixpkgs.fd \
            nixpkgs.bat \
            nixpkgs.fzf \
            nixpkgs.eza \
            nixpkgs.lazygit \
            nixpkgs.git

# Create workspace directory
RUN mkdir -p /workspace/yazelix

# Set working directory
WORKDIR /workspace

# Copy Yazelix configuration files (will be mounted/copied at runtime)
# The TypeScript worker will handle cloning the repo and setting up configs

# Ensure nix binaries are in PATH for runtime
RUN echo 'source /root/.nix-profile/etc/profile.d/nix.sh' >> /root/.bashrc

# Default command
CMD ["/bin/bash"]
