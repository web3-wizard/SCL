/**
 * SCL On-Chain Initialization Script
 * Run after deploying the Anchor program to initialize the registry and register the oracle
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

// Load IDL
const IDL_PATH = path.join(__dirname, "../target/idl/scl.json");

async function main() {
  console.log("SCL On-Chain Initialization");
  console.log("===========================\n");

  // Setup provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Load program
  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
  const programId = new PublicKey(idl.address || idl.metadata?.address);
  const program = new Program(idl, provider);

  console.log("Program ID:", programId.toBase58());
  console.log("Authority:", provider.wallet.publicKey.toBase58());
  console.log("");

  // Derive PDAs
  const [registryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vasp_registry")],
    programId
  );

  const [revocationListPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("revocation_list")],
    programId
  );

  const [merkleRootPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("compliance_merkle_root")],
    programId
  );

  console.log("Registry PDA:", registryPda.toBase58());
  console.log("Revocation List PDA:", revocationListPda.toBase58());
  console.log("Merkle Root PDA:", merkleRootPda.toBase58());
  console.log("");

  // Check if already initialized
  const registryInfo = await provider.connection.getAccountInfo(registryPda);
  if (registryInfo) {
    console.log("✓ Registry already initialized");
  } else {
    // Initialize registry
    console.log("Initializing registry...");
    const travelRuleThreshold = new anchor.BN(1_000_000_000); // 1000 USDC (6 decimals)

    try {
      await program.methods
        .initializeRegistry(travelRuleThreshold)
        .accounts({
          registry: registryPda,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("✓ Registry initialized");
    } catch (err: any) {
      console.error("Failed to initialize registry:", err.message);
    }
  }

  // Initialize revocation list
  const revocationInfo = await provider.connection.getAccountInfo(revocationListPda);
  if (revocationInfo) {
    console.log("✓ Revocation list already initialized");
  } else {
    console.log("Initializing revocation list...");
    try {
      await program.methods
        .initializeRevocationList()
        .accounts({
          revocationList: revocationListPda,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("✓ Revocation list initialized");
    } catch (err: any) {
      console.error("Failed to initialize revocation list:", err.message);
    }
  }

  // Initialize merkle root
  const merkleInfo = await provider.connection.getAccountInfo(merkleRootPda);
  if (merkleInfo) {
    console.log("✓ Merkle root already initialized");
  } else {
    console.log("Initializing merkle root...");
    try {
      await program.methods
        .initializeMerkleRoot()
        .accounts({
          merkleRoot: merkleRootPda,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("✓ Merkle root initialized");
    } catch (err: any) {
      console.error("Failed to initialize merkle root:", err.message);
    }
  }

  // Load oracle keypair from oracle/.env or generate one
  console.log("\nRegistering Oracle...");
  let oraclePubkey: PublicKey;

  // Read oracle public key from oracle service
  const oracleEnvPath = path.join(__dirname, "../oracle/.env");
  if (fs.existsSync(oracleEnvPath)) {
    const envContent = fs.readFileSync(oracleEnvPath, "utf8");
    const match = envContent.match(/ORACLE_KEYPAIR=\[([\d,\s]+)\]/);
    if (match) {
      const keypairBytes = JSON.parse(`[${match[1]}]`);
      const oracleKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairBytes));
      oraclePubkey = oracleKeypair.publicKey;
    } else {
      // Generate new oracle keypair
      const oracleKeypair = Keypair.generate();
      oraclePubkey = oracleKeypair.publicKey;
      console.log("Generated new oracle keypair");
      console.log("Add to oracle/.env:");
      console.log(`ORACLE_KEYPAIR=[${Array.from(oracleKeypair.secretKey).join(",")}]`);
    }
  } else {
    // Use hardcoded oracle pubkey from health endpoint
    try {
      const response = await fetch("http://localhost:3001/health");
      const data = await response.json();
      oraclePubkey = new PublicKey(data.oracle_pubkey);
      console.log("Using oracle pubkey from running service:", oraclePubkey.toBase58());
    } catch {
      console.log("Oracle not running, generating placeholder keypair...");
      const oracleKeypair = Keypair.generate();
      oraclePubkey = oracleKeypair.publicKey;
    }
  }

  // Register oracle
  try {
    await program.methods
      .registerOracle(oraclePubkey)
      .accounts({
        registry: registryPda,
        authority: provider.wallet.publicKey,
      })
      .rpc();
    console.log("✓ Oracle registered:", oraclePubkey.toBase58());
  } catch (err: any) {
    if (err.message.includes("already registered") || err.message.includes("OracleAlreadyRegistered")) {
      console.log("✓ Oracle already registered");
    } else {
      console.error("Failed to register oracle:", err.message);
    }
  }

  console.log("\n===========================");
  console.log("Initialization complete!");
  console.log("===========================\n");

  // Print summary
  console.log("Summary:");
  console.log("--------");
  console.log("Program ID:", programId.toBase58());
  console.log("Registry:", registryPda.toBase58());
  console.log("Oracle:", oraclePubkey.toBase58());
  console.log("");
  console.log("Your app is ready for production transfers!");
}

main().catch(console.error);
