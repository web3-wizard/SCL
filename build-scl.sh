#!/bin/bash
set -e

export PATH="/home/cyberwarrior/.local/share/solana/install/active_release/bin:/home/cyberwarrior/.cargo/bin:/home/cyberwarrior/nodejs/bin:$PATH"

SDK="/home/cyberwarrior/.local/share/solana/install/active_release/bin/sdk/sbf"
PT="$SDK/dependencies/platform-tools"

echo "=== Verifying platform-tools ==="
ls "$PT/" || { echo "ERROR: platform-tools not found!"; exit 1; }
"$PT/rust/bin/rustc" --version
echo "System cargo: $(cargo --version)"

echo "=== Building SCL program ==="
cd /mnt/c/Users/HP/OneDrive/Desktop/SCL

# Use system cargo (newer, handles edition2024 manifests) but point RUSTC to Solana's rustc
export RUSTC="$PT/rust/bin/rustc"
export RUSTFLAGS=""

# Build with system cargo but Solana rustc, targeting sbf-solana-solana
cargo build \
    --target sbf-solana-solana \
    --release \
    --manifest-path programs/scl/Cargo.toml \
    2>&1

echo ""
echo "=== Checking output ==="
find target/ -name "*.so" 2>/dev/null | head -5
echo "=== DONE ==="
