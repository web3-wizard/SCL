/**
 * SCL Deployment Script using @solana/web3.js
 * This script deploys the SCL program to devnet without requiring Solana CLI
 *
 * Prerequisites:
 * - Run: npm install
 * - Have a funded wallet keypair
 */

const {
  Connection,
  Keypair,
  PublicKey,
  BpfLoader,
  BPF_LOADER_PROGRAM_ID,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  Transaction,
  SystemProgram
} = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

const DEVNET_URL = "https://api.devnet.solana.com";

async function main() {
  console.log("========================================");
  console.log("  SCL Deployment Script (JavaScript)");
  console.log("========================================\n");

  const connection = new Connection(DEVNET_URL, "confirmed");

  // Load or create deployer wallet
  const walletPath = path.join(process.env.HOME || process.env.USERPROFILE, ".config", "solana", "id.json");
  let deployer;

  if (fs.existsSync(walletPath)) {
    const walletData = JSON.parse(fs.readFileSync(walletPath, "utf8"));
    deployer = Keypair.fromSecretKey(Uint8Array.from(walletData));
    console.log("Loaded wallet:", deployer.publicKey.toBase58());
  } else {
    // Create new wallet
    deployer = Keypair.generate();
    const walletDir = path.dirname(walletPath);
    if (!fs.existsSync(walletDir)) {
      fs.mkdirSync(walletDir, { recursive: true });
    }
    fs.writeFileSync(walletPath, JSON.stringify(Array.from(deployer.secretKey)));
    console.log("Created new wallet:", deployer.publicKey.toBase58());
  }

  // Check balance
  let balance = await connection.getBalance(deployer.publicKey);
  console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL");

  // Request airdrop if needed
  if (balance < 2 * LAMPORTS_PER_SOL) {
    console.log("\nRequesting airdrop...");
    try {
      const sig = await connection.requestAirdrop(deployer.publicKey, 2 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig);
      balance = await connection.getBalance(deployer.publicKey);
      console.log("New balance:", balance / LAMPORTS_PER_SOL, "SOL");
    } catch (err) {
      console.log("Airdrop failed (rate limited). Please fund manually:");
      console.log("  1. Go to https://faucet.solana.com");
      console.log("  2. Enter address:", deployer.publicKey.toBase58());
      console.log("  3. Request devnet SOL");
      console.log("\nThen run this script again.");
      process.exit(1);
    }
  }

  // Check if program binary exists
  const programBinaryPath = path.join(__dirname, "..", "target", "deploy", "scl.so");

  if (!fs.existsSync(programBinaryPath)) {
    console.log("\n⚠️  Program binary not found at:", programBinaryPath);
    console.log("\nTo compile the program, you need:");
    console.log("  1. Install Rust: https://rustup.rs");
    console.log("  2. Install Solana: https://docs.solana.com/cli/install-solana-cli-tools");
    console.log("  3. Install Anchor: cargo install --git https://github.com/coral-xyz/anchor avm --locked");
    console.log("  4. Run: anchor build");
    console.log("\nAlternatively, the demo mode in the app works without deployment.");

    // Create a placeholder program ID for testing
    console.log("\n--- DEMO MODE SETUP ---");
    const programKeypair = Keypair.generate();
    console.log("Generated placeholder Program ID:", programKeypair.publicKey.toBase58());

    // Update constants.ts with placeholder
    const constantsPath = path.join(__dirname, "..", "app", "src", "utils", "constants.ts");
    if (fs.existsSync(constantsPath)) {
      let content = fs.readFileSync(constantsPath, "utf8");
      content = content.replace(
        /export const SCL_PROGRAM_ID = new PublicKey\(\s*"[^"]+"\s*\)/,
        `export const SCL_PROGRAM_ID = new PublicKey(\n  "${programKeypair.publicKey.toBase58()}"\n)`
      );
      fs.writeFileSync(constantsPath, content);
      console.log("Updated constants.ts with placeholder ID");
    }

    console.log("\n✓ Demo mode is ready. Use 'Demo Mode' checkbox in the app.");
    process.exit(0);
  }

  // Deploy the program
  console.log("\nDeploying program...");
  const programData = fs.readFileSync(programBinaryPath);
  const programKeypairPath = path.join(__dirname, "..", "target", "deploy", "scl-keypair.json");

  let programKeypair;
  if (fs.existsSync(programKeypairPath)) {
    const keypairData = JSON.parse(fs.readFileSync(programKeypairPath, "utf8"));
    programKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  } else {
    programKeypair = Keypair.generate();
    fs.writeFileSync(programKeypairPath, JSON.stringify(Array.from(programKeypair.secretKey)));
  }

  console.log("Program ID:", programKeypair.publicKey.toBase58());

  try {
    // Load program using BPF loader
    await BpfLoader.load(
      connection,
      deployer,
      programKeypair,
      programData,
      BPF_LOADER_PROGRAM_ID
    );

    console.log("\n✓ Program deployed successfully!");
    console.log("Program ID:", programKeypair.publicKey.toBase58());

    // Update constants.ts
    const constantsPath = path.join(__dirname, "..", "app", "src", "utils", "constants.ts");
    if (fs.existsSync(constantsPath)) {
      let content = fs.readFileSync(constantsPath, "utf8");
      content = content.replace(
        /export const SCL_PROGRAM_ID = new PublicKey\(\s*"[^"]+"\s*\)/,
        `export const SCL_PROGRAM_ID = new PublicKey(\n  "${programKeypair.publicKey.toBase58()}"\n)`
      );
      fs.writeFileSync(constantsPath, content);
      console.log("✓ Updated constants.ts");
    }

    console.log("\n========================================");
    console.log("  Deployment Complete!");
    console.log("========================================");
    console.log("\nExplorer:", `https://explorer.solana.com/address/${programKeypair.publicKey.toBase58()}?cluster=devnet`);
    console.log("\nNext: Run 'npx ts-node scripts/initialize.ts' to initialize the registry");

  } catch (err) {
    console.error("Deployment failed:", err.message);
    process.exit(1);
  }
}

main().catch(console.error);
