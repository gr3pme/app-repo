#!/usr/bin/env bash
set -euo pipefail

# install.sh - Quick installer for app-repo
# Usage: curl -fsSL https://raw.githubusercontent.com/gr3pme/app-repo/main/install.sh | bash

REPO_URL="https://github.com/gr3pme/app-repo.git"
INSTALL_DIR="${HOME}/.app-repo"

echo "=== Installing app-repo ==="

# Check for required tools
for cmd in git node npm; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "Error: $cmd is required but not installed."
        exit 1
    fi
done

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "Error: Node.js 16+ required (found v${NODE_VERSION})"
    exit 1
fi

# Clone or update
if [ -d "$INSTALL_DIR" ]; then
    echo "Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull --quiet
else
    echo "Cloning app-repo..."
    git clone --quiet "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Install and build
echo "Installing dependencies..."
npm install --quiet

echo "Building..."
npm run build --quiet

# Symlink binary
mkdir -p "${HOME}/.local/bin"
ln -sf "${INSTALL_DIR}/dist/cli.js" "${HOME}/.local/bin/app-repo"
chmod +x "${INSTALL_DIR}/dist/cli.js"

echo ""
echo "✓ app-repo installed successfully!"
echo ""
echo "Make sure ~/.local/bin is in your PATH:"
echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
echo ""
echo "Then run: app-repo --help"
