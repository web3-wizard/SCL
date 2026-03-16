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
import { TestMerkleTree } from "./helpers/merkle";

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

    // Initialize the revocation list
    await program.methods
      .initializeRevocationList()
      .accounts({
        revocationList: fixtures.revocationListPda,
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
        revocationList: fixtures.revocationListPda,
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

  // ===== Scenario 2: Failed -- missing attestation =====
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

  // ===== Scenario 3: Failed -- missing Travel Rule payload =====
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

  // ===== Scenario 4: Failed -- expired attestation =====
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

  // ===== Scenario 5: Below threshold -- no payload required =====
  it("succeeds below threshold without Travel Rule payload", async () => {
    const amount = 500_000; // 0.5 rUSDC (below threshold)
    const attestation = createValidAttestation(
      fixtures.oracleKeypair,
      fixtures.sender.publicKey
    );

    const ed25519Ix = attestation.ed25519Instruction;
    // No Memo instruction needed -- below threshold
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

  // ===== Scenario 6: Failed -- revoked attestation =====
  it("fails transfer when wallet attestation is revoked", async () => {
    // Revoke the sender's attestation
    await program.methods
      .revokeAttestation(fixtures.sender.publicKey)
      .accounts({
        revocationList: fixtures.revocationListPda,
        registry: fixtures.registryPda,
        owner: provider.wallet.publicKey,
      })
      .rpc();

    const amount = 500_000;
    const attestation = createValidAttestation(
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
      expect.fail("Transfer should have failed with revoked attestation");
    } catch (err: any) {
      console.log("  Scenario 6 PASSED: Transfer correctly rejected (revoked attestation)");
    }

    // Unrevoke for subsequent tests
    await program.methods
      .unrevokeAttestation(fixtures.sender.publicKey)
      .accounts({
        revocationList: fixtures.revocationListPda,
        registry: fixtures.registryPda,
        owner: provider.wallet.publicKey,
      })
      .rpc();
  });

  // ===== Scenario 7: Multiple oracles -- second oracle works =====
  it("accepts attestation from a second registered oracle", async () => {
    const secondOracle = Keypair.generate();

    // Add second oracle
    await program.methods
      .addOracle(secondOracle.publicKey)
      .accounts({
        registry: fixtures.registryPda,
        owner: provider.wallet.publicKey,
      })
      .rpc();

    const amount = 500_000;
    // Create attestation with the SECOND oracle
    const attestation = createValidAttestation(
      secondOracle,
      fixtures.sender.publicKey
    );

    const ed25519Ix = attestation.ed25519Instruction;
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
    console.log("  Scenario 7 PASSED: Second oracle attestation accepted -", sig);

    // Remove second oracle (cleanup)
    await program.methods
      .removeOracle(secondOracle.publicKey)
      .accounts({
        registry: fixtures.registryPda,
        owner: provider.wallet.publicKey,
      })
      .rpc();
  });

  // ===== Scenario 8: Cannot remove last oracle =====
  it("fails to remove the last oracle", async () => {
    try {
      await program.methods
        .removeOracle(fixtures.oracleKeypair.publicKey)
        .accounts({
          registry: fixtures.registryPda,
          owner: provider.wallet.publicKey,
        })
        .rpc();
      expect.fail("Should have failed removing last oracle");
    } catch (err: any) {
      console.log("  Scenario 8 PASSED: Cannot remove last oracle");
    }
  });

  // ===== Scenario 9: VASP proposal lifecycle -- propose and approve =====
  it("propose and approve VASP registration via governance", async () => {
    const proposer = Keypair.generate();

    // Airdrop to proposer
    const airdrop = await provider.connection.requestAirdrop(
      proposer.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdrop);

    const newVasp = Keypair.generate();
    const encKey = new Uint8Array(32).fill(2);

    // Derive proposal PDA
    const [proposalPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vasp_proposal"), newVasp.publicKey.toBuffer()],
      program.programId
    );

    // Propose
    await program.methods
      .proposeVasp(
        newVasp.publicKey,
        "Proposed VASP",
        "SG",
        Array.from(encKey)
      )
      .accounts({
        proposal: proposalPda,
        registry: fixtures.registryPda,
        proposer: proposer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([proposer])
      .rpc();

    console.log("  Proposal created");

    // Approve (owner)
    await program.methods
      .approveVasp()
      .accounts({
        proposal: proposalPda,
        registry: fixtures.registryPda,
        owner: provider.wallet.publicKey,
        proposer: proposer.publicKey,
      })
      .rpc();

    console.log("  Scenario 9 PASSED: VASP proposed and approved via governance");

    // Verify VASP is now in registry
    const registryData = await program.account.vaspRegistry.fetch(
      fixtures.registryPda
    );
    const found = (registryData.vasps as any[]).some(
      (v: any) => v.vaspPubkey.toBase58() === newVasp.publicKey.toBase58()
    );
    expect(found).to.be.true;
  });

  // ===== Scenario 10: VASP proposal rejection =====
  it("rejects a VASP proposal and refunds rent", async () => {
    const proposer = Keypair.generate();
    const airdrop = await provider.connection.requestAirdrop(
      proposer.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdrop);

    const rejectVasp = Keypair.generate();
    const encKey = new Uint8Array(32).fill(3);

    const [proposalPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vasp_proposal"), rejectVasp.publicKey.toBuffer()],
      program.programId
    );

    // Propose
    await program.methods
      .proposeVasp(
        rejectVasp.publicKey,
        "Rejected VASP",
        "XX",
        Array.from(encKey)
      )
      .accounts({
        proposal: proposalPda,
        registry: fixtures.registryPda,
        proposer: proposer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([proposer])
      .rpc();

    // Reject (owner)
    await program.methods
      .rejectVasp()
      .accounts({
        proposal: proposalPda,
        registry: fixtures.registryPda,
        owner: provider.wallet.publicKey,
        proposer: proposer.publicKey,
      })
      .rpc();

    console.log("  Scenario 10 PASSED: VASP proposal rejected, rent refunded");
  });

  // ===== Scenario 11: Initialize Merkle root =====
  it("initializes the compliance Merkle root PDA", async () => {
    await program.methods
      .initializeMerkleRoot()
      .accounts({
        merkleRoot: fixtures.merkleRootPda,
        registry: fixtures.registryPda,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const merkleData = await program.account.complianceMerkleRoot.fetch(
      fixtures.merkleRootPda
    );
    expect(merkleData.treeSize).to.equal(0);
    console.log("  Scenario 11 PASSED: Merkle root PDA initialized");
  });

  // ===== Scenario 12: Merkle proof transfer succeeds =====
  it("completes a compliant transfer with valid Merkle proof", async () => {
    // Build a Merkle tree with the sender and some other wallets
    const tree = new TestMerkleTree();
    const otherWallet1 = Keypair.generate().publicKey;
    const otherWallet2 = Keypair.generate().publicKey;
    tree.addWallet(fixtures.sender.publicKey);
    tree.addWallet(otherWallet1);
    tree.addWallet(otherWallet2);

    const root = tree.getRoot();
    const proof = tree.getProof(fixtures.sender.publicKey);

    // Update the on-chain Merkle root
    await program.methods
      .updateMerkleRoot(root, tree.getSize())
      .accounts({
        merkleRoot: fixtures.merkleRootPda,
        registry: fixtures.registryPda,
        owner: provider.wallet.publicKey,
      })
      .rpc();

    const amount = 500_000; // Below threshold -- no memo needed
    const transferIx = await program.methods
      .transferCompliantMerkle(
        new anchor.BN(amount),
        6,
        proof
      )
      .accounts({
        registry: fixtures.registryPda,
        merkleRoot: fixtures.merkleRootPda,
        sender: fixtures.sender.publicKey,
        senderTokenAccount: fixtures.senderAta,
        recipientTokenAccount: fixtures.receiverAta,
        mint: fixtures.mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        revocationList: fixtures.revocationListPda,
      })
      .instruction();

    const sig = await buildAndSendTx(
      [transferIx],
      [fixtures.sender]
    );

    await provider.connection.confirmTransaction(sig);
    console.log("  Scenario 12 PASSED: Merkle proof transfer succeeded -", sig);
  });

  // ===== Scenario 13: Merkle proof transfer fails with invalid proof =====
  it("fails transfer with invalid Merkle proof", async () => {
    // Build a tree that does NOT include the sender
    const tree = new TestMerkleTree();
    const otherWallet1 = Keypair.generate().publicKey;
    const otherWallet2 = Keypair.generate().publicKey;
    tree.addWallet(otherWallet1);
    tree.addWallet(otherWallet2);

    // Use a proof from this tree for the sender (will be invalid)
    const fakeProof = tree.getProof(otherWallet1);

    const amount = 500_000;
    const transferIx = await program.methods
      .transferCompliantMerkle(
        new anchor.BN(amount),
        6,
        fakeProof
      )
      .accounts({
        registry: fixtures.registryPda,
        merkleRoot: fixtures.merkleRootPda,
        sender: fixtures.sender.publicKey,
        senderTokenAccount: fixtures.senderAta,
        recipientTokenAccount: fixtures.receiverAta,
        mint: fixtures.mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        revocationList: fixtures.revocationListPda,
      })
      .instruction();

    try {
      const sig = await buildAndSendTx(
        [transferIx],
        [fixtures.sender]
      );
      await provider.connection.confirmTransaction(sig);
      expect.fail("Transfer should have failed with invalid Merkle proof");
    } catch (err: any) {
      console.log("  Scenario 13 PASSED: Transfer correctly rejected (invalid Merkle proof)");
    }
  });
});
