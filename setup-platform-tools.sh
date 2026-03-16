#!/bin/bash
set -e

export PATH="/home/cyberwarrior/.local/share/solana/install/active_release/bin:/home/cyberwarrior/.cargo/bin:/home/cyberwarrior/nodejs/bin:$PATH"

SDK_DEPS="/home/cyberwarrior/.local/share/solana/install/active_release/bin/sdk/sbf/dependencies"

echo "=== Marking platform-tools version ==="
touch "$SDK_DEPS/platform-tools-v1.43.md"

echo "=== Linking solana toolchain ==="
rustup toolchain link solana "$SDK_DEPS/platform-tools/rust" 2>&1 || echo "toolchain link skipped"

echo "=== Verifying platform-tools rustc ==="
"$SDK_DEPS/platform-tools/rust/bin/rustc" --version

echo "=== Building SCL program ==="
cd /mnt/c/Users/HP/OneDrive/Desktop/SCL
cargo-build-sbf --manifest-path programs/scl/Cargo.toml 2>&1

echo "=== BUILD COMPLETE ==="
ls -la target/deploy/*.so 2>/dev/null && echo "Program binary found!"
