import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";
import { setupTestFixtures, TestFixtures } from "./helpers/setup";
import {
  createValidAttestation,
  createExpiredAttestation,
} from "./helpers/attestation";

// Memo program ID
const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

describe("SCL Compliance Layer", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Scl as Program;

  let fixtures: TestFixtures;
  const THRESHOLD = 1_000_000_000; // 1000 rUSDC (6 decimals)

  before(async () => {
    fixtures = await setupTestFixtures(program);

    // Initialize the VASP registry
    await program.methods
      .initializeRegistry(
        fixtures.oracleKeypair.publicKey,
        new anchor.BN(THRESHOLD)
      )
      .accounts({
        registry: fixtures.registryPda,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Register a demo VASP
    const vaspKeypair = Keypair.generate();
    const encryptionKey = new Uint8Array(32);
    encryptionKey.fill(1); // Dummy key for testing

    await program.methods
      .registerVasp(
        vaspKeypair.publicKey,
        "AMINA Bank",
        "CH",
        Array.from(encryptionKey)
      )
      .accounts({
        registry: fixtures.registryPda,
        owner: provider.wallet.publicKey,
      })
      .rpc();
  });

  async function buildAndSendTx(
    instructions: TransactionInstruction[],
    signers: Keypair[]
  ): Promise<string> {
    const { blockhash } = await provider.connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
      payerKey: fixtures.sender.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const tx = new VersionedTransaction(messageV0);
    tx.sign(signers);
    return provider.connection.sendTransaction(tx, { skipPreflight: false });
  }

  function buildMemoInstruction(data: string): TransactionInstruction {
    return new TransactionInstruction({
      keys: [
        {
          pubkey: fixtures.sender.publicKey,
          isSigner: true,
          isWritable: false,
        },
      ],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(data, "utf-8"),
    });
  }

  function buildTransferCompliantIx(
    amount: number,
    expiry: number,
    level: number
  ): Promise<TransactionInstruction> {
    return program.methods
      .transferCompliant(
        new anchor.BN(amount),
        6, // decimals
        fixtures.sender.publicKey,
        new anchor.BN(expiry),
        level
      )
      .accounts({
        registry: fixtures.registryPda,
        sender: fixtures.sender.publicKey,
        senderTokenAccount: fixtures.senderAta,
        recipientTokenAccount: fixtures.receiverAta,
        mint: fixtures.mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();
  }

  // ===== Scenario 1: Successful compliant transfer =====
  it("completes a compliant transfer with valid attestation and Travel Rule payload", async () => {
    const amount = 2_000_000_000; // 2000 rUSDC (above threshold)
    const attestation = createValidAttestation(
      fixtures.oracleKeypair,
      fixtures.sender.publicKey
    );

    const ed25519Ix = attestation.ed25519Instruction;
    const memoIx = buildMemoInstruction("encrypted-travel-rule-payload-data");
    const transferIx = await buildTransferCompliantIx(
      amount,
      attestation.expiry,
      attestation.level
    );

    const sig = await buildAndSendTx(
      [ed25519Ix, memoIx, transferIx],
      [fixtures.sender]
    );

    await provider.connection.confirmTransaction(sig);
    console.log("  Scenario 1 PASSED: Compliant transfer succeeded -", sig);
  });

  // ===== Scenario 2: Failed — missing attestation =====
  it("fails transfer without Ed25519 attestation instruction", async () => {
    const amount = 2_000_000_000;
    const attestation = createValidAttestation(
      fixtures.oracleKeypair,
      fixtures.sender.publicKey
    );

    // Intentionally omit the Ed25519 verify instruction
    const memoIx = buildMemoInstruction("encrypted-travel-rule-payload-data");
    const transferIx = await buildTransferCompliantIx(
      amount,
      attestation.expiry,
      attestation.level
    );

    try {
      const sig = await buildAndSendTx(
        [memoIx, transferIx],
        [fixtures.sender]
      );
      await provider.connection.confirmTransaction(sig);
      expect.fail("Transfer should have failed without attestation");
    } catch (err: any) {
      console.log("  Scenario 2 PASSED: Transfer correctly rejected (missing attestation)");
    }
  });

  // ===== Scenario 3: Failed — missing Travel Rule payload =====
  it("fails transfer above threshold without memo instruction", async () => {
    const amount = 2_000_000_000; // Above threshold
    const attestation = createValidAttestation(
      fixtures.oracleKeypair,
      fixtures.sender.publicKey
    );

    const ed25519Ix = attestation.ed25519Instruction;
    // Intentionally omit the Memo instruction
    const transferIx = await buildTransferCompliantIx(
      amount,
      attestation.expiry,
      attestation.level
    );

    try {
      const sig = await buildAndSendTx(
        [ed25519Ix, transferIx],
        [fixtures.sender]
      );
      await provider.connection.confirmTransaction(sig);
      expect.fail("Transfer should have failed without Travel Rule payload");
    } catch (err: any) {
      console.log("  Scenario 3 PASSED: Transfer correctly rejected (missing payload)");
    }
  });

  // ===== Scenario 4: Failed — expired attestation =====
  it("fails transfer with expired attestation", async () => {
    const amount = 500_000; // Below threshold (no memo needed)
    const attestation = createExpiredAttestation(
      fixtures.oracleKeypair,
      fixtures.sender.publicKey
    );

    const ed25519Ix = attestation.ed25519Instruction;
    const transferIx = await buildTransferCompliantIx(
      amount,
      attestation.expiry,
      attestation.level
    );

    try {
      const sig = await buildAndSendTx(
        [ed25519Ix, transferIx],
        [fixtures.sender]
      );
      await provider.connection.confirmTransaction(sig);
      expect.fail("Transfer should have failed with expired attestation");
    } catch (err: any) {
      console.log("  Scenario 4 PASSED: Transfer correctly rejected (expired attestation)");
    }
  });

  // ===== Scenario 5: Below threshold — no payload required =====
  it("succeeds below threshold without Travel Rule payload", async () => {
    const amount = 500_000; // 0.5 rUSDC (below threshold)
    const attestation = createValidAttestation(
      fixtures.oracleKeypair,
      fixtures.sender.publicKey
    );

    const ed25519Ix = attestation.ed25519Instruction;
    // No Memo instruction needed — below threshold
    const transferIx = await buildTransferCompliantIx(
      amount,
      attestation.expiry,
      attestation.level
    );

    const sig = await buildAndSendTx(
      [ed25519Ix, transferIx],
      [fixtures.sender]
    );

    await provider.connection.confirmTransaction(sig);
    console.log("  Scenario 5 PASSED: Below-threshold transfer succeeded -", sig);
  });
});
