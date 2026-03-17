#!/bin/bash
# Setup script for GitHub Codespaces

set -e

echo "=== Installing Solana CLI ==="
sh -c "$(curl -sSfL https://release.solana.com/v1.18.4/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.bashrc

echo "=== Installing Anchor ==="
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.30.1
avm use 0.30.1

echo "=== Configuring Solana for Devnet ==="
solana config set --url devnet
solana-keygen new --no-bip39-passphrase -o ~/.config/solana/id.json --force

echo "=== Installing Node Dependencies ==="
npm install

echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Run: solana airdrop 2"
echo "  2. Run: anchor build"
echo "  3. Run: anchor deploy --provider.cluster devnet"
echo "  4. Run: npm run dev (in /oracle)"
echo "  5. Run: npm run dev (in /app)"
