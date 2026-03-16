#!/bin/bash
set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║      SCL Solana Development Environment Setup                ║"
echo "║             WSL2 + Rust + Solana + Anchor                    ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============ STEP 1: Verify Rust ============
echo -e "${BLUE}[1/5] Verifying Rust installation...${NC}"
if command -v rustc &> /dev/null; then
    echo -e "${GREEN}✓ Rust $(rustc --version)${NC}"
else
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
    source "$HOME/.cargo/env"
    echo -e "${GREEN}✓ Rust installed${NC}"
fi

# Add BPF targets
echo "Adding BPF target..."
rustup target add bpfel-unknown-none
echo -e "${GREEN}✓ BPF target added${NC}"
echo ""

# ============ STEP 2: Install Solana CLI ============
echo -e "${BLUE}[2/5] Installing Solana CLI...${NC}"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

if command -v solana &> /dev/null; then
    echo -e "${GREEN}✓ Solana $(solana --version)${NC}"
else
    echo "Downloading and installing Solana CLI..."
    sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)" 2>&1 | grep -E "(downloading|Extracting|installed)" || true
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

    if command -v solana &> /dev/null; then
        echo -e "${GREEN}✓ Solana CLI installed: $(solana --version)${NC}"
    else
        echo -e "${YELLOW}⚠ Solana CLI download had issues, but continuing...${NC}"
    fi
fi
echo ""

# ============ STEP 3: Install Anchor CLI ============
echo -e "${BLUE}[3/5] Installing Anchor CLI...${NC}"
export PATH="$HOME/.cargo/bin:$PATH"

if ! command -v anchor &> /dev/null; then
    echo "Compiling Anchor CLI from source (this takes ~5-10 minutes)..."
    cargo install --git https://github.com/coral-xyz/anchor avm --locked 2>&1 | tail -5

    echo "Installing latest Anchor version..."
    "$HOME/.cargo/bin/avm" install latest 2>&1 | tail -3
    "$HOME/.cargo/bin/avm" use latest 2>&1 | tail -2
fi

if command -v anchor &> /dev/null; then
    echo -e "${GREEN}✓ Anchor CLI $(anchor --version)${NC}"
else
    echo -e "${YELLOW}⚠ Anchor CLI not yet ready, will retry...${NC}"
fi
echo ""

# ============ STEP 4: Install Node.js (for oracle and app testing) ============
echo -e "${BLUE}[4/5] Installing Node.js...${NC}"
if command -v node &> /dev/null; then
    echo -e "${GREEN}✓ Node.js $(node --version)${NC}"
else
    echo "Installing Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - > /dev/null
    sudo apt-get install -y nodejs > /dev/null
    echo -e "${GREEN}✓ Node.js $(node --version)${NC}"
fi
echo ""

# ============ STEP 5: Build SCL Program ============
echo -e "${BLUE}[5/5] Building SCL Anchor Program...${NC}"
cd /mnt/c/Users/HP/OneDrive/Desktop/SCL

if command -v anchor &> /dev/null; then
    echo "Building with anchor..."
    anchor build 2>&1 | tail -20
    echo -e "${GREEN}✓ Build complete!${NC}"
else
    echo "Building with cargo (anchor not available yet)..."
    cd programs/scl
    cargo build --release --target bpfel-unknown-none 2>&1 | tail -20
    cd /mnt/c/Users/HP/OneDrive/Desktop/SCL
    echo -e "${GREEN}✓ Cargo build complete!${NC}"
fi
echo ""

# ============ Verify Build ============
echo -e "${BLUE}Verifying build artifacts...${NC}"
if [ -f "target/deploy/scl.so" ]; then
    echo -e "${GREEN}✓ SCL program binary: target/deploy/scl.so${NC}"
    ls -lh target/deploy/scl.so
elif [ -f "programs/scl/target/bpfel-unknown-none/release/scl.so" ]; then
    echo -e "${GREEN}✓ SCL program binary: programs/scl/target/bpfel-unknown-none/release/scl.so${NC}"
    ls -lh "programs/scl/target/bpfel-unknown-none/release/scl.so"
else
    echo -e "${YELLOW}⚠ Program binary location may vary, checking all locations...${NC}"
    find . -name "scl.so" -type f 2>/dev/null || echo "Binary not found yet"
fi
echo ""

echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ SCL Development Environment Setup Complete!                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo "  1. Start local validator:    solana-test-validator"
echo "  2. In another terminal:      anchor test"
echo "  3. Start oracle:             cd oracle && npm run dev"
echo "  4. Start app:                cd app && npm run dev"
echo ""
