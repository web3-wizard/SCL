#!/bin/bash
# SCL Full Deployment Script for Devnet
# Run this after installing Solana CLI and Anchor

set -e

echo "=========================================="
echo "  SCL - Solana Compliance Layer Deploy"
echo "=========================================="

# Check prerequisites
check_prereqs() {
    echo "[1/7] Checking prerequisites..."

    if ! command -v solana &> /dev/null; then
        echo "ERROR: Solana CLI not found. Install from: https://docs.solana.com/cli/install-solana-cli-tools"
        exit 1
    fi

    if ! command -v anchor &> /dev/null; then
        echo "ERROR: Anchor CLI not found. Install with: cargo install --git https://github.com/coral-xyz/anchor avm --locked"
        exit 1
    fi

    echo "✓ Solana CLI: $(solana --version)"
    echo "✓ Anchor CLI: $(anchor --version)"
}

# Configure for devnet
configure_devnet() {
    echo ""
    echo "[2/7] Configuring for devnet..."
    solana config set --url devnet
    echo "✓ Set cluster to devnet"
}

# Check wallet balance
check_balance() {
    echo ""
    echo "[3/7] Checking wallet balance..."
    BALANCE=$(solana balance 2>/dev/null || echo "0 SOL")
    echo "Current balance: $BALANCE"

    if [[ "$BALANCE" == "0 SOL" ]] || [[ "$BALANCE" < "2" ]]; then
        echo "⚠ Low balance. Requesting airdrop..."
        solana airdrop 2 || echo "Airdrop failed - faucet may be rate limited. Try: https://faucet.solana.com"
    fi
}

# Build the program
build_program() {
    echo ""
    echo "[4/7] Building Anchor program..."
    anchor build

    # Extract program ID from keypair
    PROGRAM_ID=$(solana address -k target/deploy/scl-keypair.json)
    echo "✓ Program ID: $PROGRAM_ID"

    # Update Anchor.toml
    sed -i "s/scl = \".*\"/scl = \"$PROGRAM_ID\"/" Anchor.toml
    echo "✓ Updated Anchor.toml"

    # Update app constants
    sed -i "s/\"11111111111111111111111111111111\"/\"$PROGRAM_ID\"/" app/src/utils/constants.ts
    echo "✓ Updated app/src/utils/constants.ts"

    # Rebuild with correct program ID
    anchor build
}

# Deploy to devnet
deploy_program() {
    echo ""
    echo "[5/7] Deploying to devnet..."
    anchor deploy --provider.cluster devnet
    echo "✓ Program deployed!"
}

# Initialize the registry
initialize_registry() {
    echo ""
    echo "[6/7] Initializing on-chain registry..."

    # Run initialization script
    npx ts-node scripts/initialize.ts
    echo "✓ Registry initialized"
}

# Summary
print_summary() {
    echo ""
    echo "=========================================="
    echo "  Deployment Complete!"
    echo "=========================================="
    echo ""
    PROGRAM_ID=$(solana address -k target/deploy/scl-keypair.json 2>/dev/null || echo "unknown")
    echo "Program ID: $PROGRAM_ID"
    echo "Network: Devnet"
    echo ""
    echo "Explorer: https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
    echo ""
    echo "Next steps:"
    echo "  1. Start the oracle: cd oracle && npm run dev"
    echo "  2. Start the frontend: cd app && npm run dev"
    echo "  3. Connect wallet and uncheck 'Demo Mode'"
    echo ""
}

# Main
check_prereqs
configure_devnet
check_balance
build_program
deploy_program
initialize_registry
print_summary
