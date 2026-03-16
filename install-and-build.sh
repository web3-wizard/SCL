#!/bin/bash
# Script to install platform-tools and build SCL program
# Run inside WSL after platform-tools download completes on Windows

set -e

export PATH="$HOME/nodejs/bin:$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"

PLATFORM_TOOLS_SRC="/mnt/c/Users/HP/Downloads/platform-tools-linux-x86_64.tar.bz2"
SDK_DEPS="$HOME/.local/share/solana/install/active_release/bin/sdk/sbf/dependencies"
CACHE_DIR="$HOME/.cache/solana/v1.43/platform-tools"

echo "=== Step 1: Verify platform-tools download ==="
EXPECTED_SIZE=393244174
ACTUAL_SIZE=$(stat -c%s "$PLATFORM_TOOLS_SRC" 2>/dev/null || echo "0")
echo "File size: $ACTUAL_SIZE / $EXPECTED_SIZE bytes"

if [ "$ACTUAL_SIZE" -lt "$EXPECTED_SIZE" ]; then
    echo "ERROR: Download incomplete ($ACTUAL_SIZE < $EXPECTED_SIZE). Wait for download to finish."
    exit 1
fi

echo "=== Step 2: Copy tarball to WSL native filesystem ==="
cp "$PLATFORM_TOOLS_SRC" /tmp/platform-tools-linux-x86_64.tar.bz2
echo "Copied to /tmp/"

echo "=== Step 3: Install platform-tools to SDK dependencies ==="
mkdir -p "$SDK_DEPS"
cd "$SDK_DEPS"
rm -rf platform-tools
mkdir -p platform-tools
tar --strip-components=1 -jxf /tmp/platform-tools-linux-x86_64.tar.bz2 -C platform-tools
touch platform-tools-v1.43.md
echo "Installed to $SDK_DEPS/platform-tools"

echo "=== Step 4: Also install to cache directory ==="
mkdir -p "$CACHE_DIR"
cp -r "$SDK_DEPS/platform-tools/"* "$CACHE_DIR/"
echo "Installed to $CACHE_DIR"

echo "=== Step 5: Link solana toolchain ==="
rustup toolchain link solana "$SDK_DEPS/platform-tools/rust" 2>/dev/null || true
echo "Toolchain linked"

echo "=== Step 6: Verify installation ==="
"$SDK_DEPS/platform-tools/rust/bin/rustc" --version || echo "WARNING: rustc not found in platform-tools"
echo ""

echo "=== Step 7: Build SCL program ==="
cd /mnt/c/Users/HP/OneDrive/Desktop/SCL
cargo-build-sbf --manifest-path programs/scl/Cargo.toml 2>&1

echo ""
echo "=== BUILD COMPLETE ==="
ls -la target/deploy/*.so 2>/dev/null && echo "Program binary found!" || echo "No .so file found"
