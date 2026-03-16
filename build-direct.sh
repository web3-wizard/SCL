#!/bin/bash
set -e

export PATH="/home/cyberwarrior/.local/share/solana/install/active_release/bin:/home/cyberwarrior/.cargo/bin:/home/cyberwarrior/nodejs/bin:$PATH"

SDK="/home/cyberwarrior/.local/share/solana/install/active_release/bin/sdk/sbf"
PLATFORM_TOOLS="$SDK/dependencies/platform-tools"

echo "=== Checking toolchain ==="
rustup toolchain list
echo ""

echo "=== Solana rustc version ==="
cargo +solana rustc -- --version

echo "=== Setting up build environment ==="
export SBF_SDK_PATH="$SDK"

# Build using cargo +solana with sbf target
cd /mnt/c/Users/HP/OneDrive/Desktop/SCL

echo "=== Building with cargo +solana ==="
cargo +solana build --target sbf-solana-solana --release \
  -Z build-std=std,panic_abort \
  --manifest-path programs/scl/Cargo.toml 2>&1

echo "=== BUILD COMPLETE ==="
