import * as anchor from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  Connection,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Ed25519Program,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { sha256 } from "@noble/hashes/sha256";
import nacl from "tweetnacl";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const THRESHOLD = 1_000_000_000; // 1000 rUSDC

/**
 * End-to-end demo script running all 5 scenarios.
 * Prerequisites:
 *   1. `solana-test-validator` running
 *   2. `anchor deploy` completed
 *   3. Oracle running on port 3001
 *
 * Run: npx ts-node scripts/demo.ts
 */
async function main() {
  console.log("=== SCL Demo Script ===\n");

  // Setup provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Scl;
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  // Generate test keys
  const oracleKeypair = Keypair.generate();
  const sender = Keypair.generate();
  const receiver = Keypair.generate();

  // Airdrop SOL
  console.log("Airdropping SOL...");
  await connection.requestAirdrop(sender.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL);
  await connection.requestAirdrop(payer.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL);
  await new Promise((r) => setTimeout(r, 2000));

  // Create rUSDC mint
  console.log("Creating rUSDC mint...");
  const mint = await createMint(
    connection, payer, payer.publicKey, null, 6,
    Keypair.generate(), undefined, TOKEN_2022_PROGRAM_ID
  );

  const senderAta = (await getOrCreateAssociatedTokenAccount(
    connection, payer, mint, sender.publicKey,
    false, undefined, undefined, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  )).address;

  const receiverAta = (await getOrCreateAssociatedTokenAccount(
    connection, payer, mint, receiver.publicKey,
    false, undefined, undefined, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  )).address;

  await mintTo(connection, payer, mint, senderAta, payer, 10_000_000_000, [], undefined, TOKEN_2022_PROGRAM_ID);
  console.log("Minted 10,000 rUSDC to sender\n");

  // Initialize registry
  const [registryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vasp_registry")], program.programId
  );

  console.log("Initializing VASP registry...");
  await program.methods
    .initializeRegistry(oracleKeypair.publicKey, new anchor.BN(THRESHOLD))
    .accounts({
      registry: registryPda,
      owner: payer.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  // Helper functions
  function createAttestation(wallet: PublicKey, expiry: number, level: number) {
    const preimage = Buffer.alloc(41);
    preimage.set(wallet.toBytes(), 0);
    preimage.writeBigInt64LE(BigInt(expiry), 32);
    preimage.writeUInt8(level, 40);
    const messageHash = sha256(preimage);
    const signature = nacl.sign.detached(messageHash, oracleKeypair.secretKey);
    return {
      ed25519Ix: Ed25519Program.createInstructionWithPublicKey({
        publicKey: oracleKeypair.publicKey.toBytes(),
        message: Buffer.from(messageHash),
        signature: Buffer.from(signature),
      }),
      expiry,
      level,
    };
  }

  function memoIx(data: string): TransactionInstruction {
    return new TransactionInstruction({
      keys: [{ pubkey: sender.publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(data, "utf-8"),
    });
  }

  async function transferIx(amount: number, expiry: number, level: number) {
    return program.methods
      .transferCompliant(new anchor.BN(amount), 6, sender.publicKey, new anchor.BN(expiry), level)
      .accounts({
        registry: registryPda,
        sender: sender.publicKey,
        senderTokenAccount: senderAta,
        recipientTokenAccount: receiverAta,
        mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();
  }

  async function sendTx(ixs: TransactionInstruction[], signers: Keypair[]) {
    const { blockhash } = await connection.getLatestBlockhash();
    const msg = new TransactionMessage({
      payerKey: sender.publicKey,
      recentBlockhash: blockhash,
      instructions: ixs,
    }).compileToV0Message();
    const tx = new VersionedTransaction(msg);
    tx.sign(signers);
    const sig = await connection.sendTransaction(tx);
    await connection.confirmTransaction(sig);
    return sig;
  }

  let passed = 0;
  let failed = 0;

  // Scenario 1: Successful compliant transfer
  console.log("--- Scenario 1: Compliant transfer (above threshold) ---");
  try {
    const att = createAttestation(sender.publicKey, Math.floor(Date.now() / 1000) + 3600, 1);
    const ix = await transferIx(2_000_000_000, att.expiry, att.level);
    const sig = await sendTx([att.ed25519Ix, memoIx("travel-rule-data"), ix], [sender]);
    console.log(`  PASS: ${sig}\n`);
    passed++;
  } catch (e: any) {
    console.log(`  FAIL: ${e.message}\n`);
    failed++;
  }

  // Scenario 2: Missing attestation
  console.log("--- Scenario 2: Missing attestation ---");
  try {
    const att = createAttestation(sender.publicKey, Math.floor(Date.now() / 1000) + 3600, 1);
    const ix = await transferIx(2_000_000_000, att.expiry, att.level);
    await sendTx([memoIx("travel-rule-data"), ix], [sender]);
    console.log("  FAIL: Should have been rejected\n");
    failed++;
  } catch {
    console.log("  PASS: Correctly rejected\n");
    passed++;
  }

  // Scenario 3: Missing Travel Rule payload
  console.log("--- Scenario 3: Missing Travel Rule payload (above threshold) ---");
  try {
    const att = createAttestation(sender.publicKey, Math.floor(Date.now() / 1000) + 3600, 1);
    const ix = await transferIx(2_000_000_000, att.expiry, att.level);
    await sendTx([att.ed25519Ix, ix], [sender]);
    console.log("  FAIL: Should have been rejected\n");
    failed++;
  } catch {
    console.log("  PASS: Correctly rejected\n");
    passed++;
  }

  // Scenario 4: Expired attestation
  console.log("--- Scenario 4: Expired attestation ---");
  try {
    const att = createAttestation(sender.publicKey, Math.floor(Date.now() / 1000) - 3600, 1);
    const ix = await transferIx(500_000, att.expiry, att.level);
    await sendTx([att.ed25519Ix, ix], [sender]);
    console.log("  FAIL: Should have been rejected\n");
    failed++;
  } catch {
    console.log("  PASS: Correctly rejected\n");
    passed++;
  }

  // Scenario 5: Below threshold (no payload needed)
  console.log("--- Scenario 5: Below threshold (no Travel Rule needed) ---");
  try {
    const att = createAttestation(sender.publicKey, Math.floor(Date.now() / 1000) + 3600, 1);
    const ix = await transferIx(500_000, att.expiry, att.level);
    const sig = await sendTx([att.ed25519Ix, ix], [sender]);
    console.log(`  PASS: ${sig}\n`);
    passed++;
  } catch (e: any) {
    console.log(`  FAIL: ${e.message}\n`);
    failed++;
  }

  console.log(`\n=== Results: ${passed}/5 passed, ${failed}/5 failed ===`);
}

main().catch(console.error);
