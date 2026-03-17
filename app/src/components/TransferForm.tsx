import { useState, FormEvent, useEffect, useMemo } from "react";
import { useConnection, useWallet, useAnchorWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  TransactionMessage,
  VersionedTransaction,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Ed25519Program
} from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { sha256 } from "@noble/hashes/sha256";
import { Buffer } from "buffer";
import { useAttestation } from "../hooks/useAttestation";
import { AttestationBadge } from "./AttestationBadge";
import { StatusDisplay } from "./StatusDisplay";
import { encryptTravelRule, TravelRulePayload } from "../utils/encryption";
import {
  SCL_PROGRAM_ID,
  TRAVEL_RULE_THRESHOLD,
  ORACLE_URL,
  TOKEN_2022_PROGRAM_ID,
  MEMO_PROGRAM_ID
} from "../utils/constants";

// Import IDL - you'll need to generate this after anchor build
import IDL from "../idl/scl.json";

export function TransferForm() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const anchorWallet = useAnchorWallet();
  const { attestation, loading: attLoading, error: attError, requestAttestation } = useAttestation();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [tokenMint, setTokenMint] = useState("");
  const [originatorName, setOriginatorName] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<{ signature: string; success: boolean } | null>(null);
  const [demoMode, setDemoMode] = useState(true);
  const [programReady, setProgramReady] = useState(false);

  // Initialize Anchor program
  const program = useMemo(() => {
    if (!anchorWallet || demoMode) return null;
    try {
      const provider = new AnchorProvider(connection, anchorWallet, {
        commitment: "confirmed",
      });
      // Check if program ID is placeholder
      if (SCL_PROGRAM_ID.toBase58() === "11111111111111111111111111111111") {
        return null;
      }
      return new Program(IDL as any, provider);
    } catch (err) {
      console.error("Failed to initialize Anchor program:", err);
      return null;
    }
  }, [anchorWallet, connection, demoMode]);

  // Check if program is deployed
  useEffect(() => {
    async function checkProgram() {
      if (demoMode) {
        setProgramReady(true);
        return;
      }
      if (SCL_PROGRAM_ID.toBase58() === "11111111111111111111111111111111") {
        setProgramReady(false);
        return;
      }
      try {
        const info = await connection.getAccountInfo(SCL_PROGRAM_ID);
        setProgramReady(info !== null);
      } catch {
        setProgramReady(false);
      }
    }
    checkProgram();
  }, [connection, demoMode]);

  if (!publicKey) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "#666" }}>
        Connect your wallet to begin
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTxLoading(true);
    setTxError(null);
    setTxResult(null);

    try {
      // Validate recipient address
      let recipientPubkey: PublicKey;
      try {
        recipientPubkey = new PublicKey(recipient);
      } catch {
        throw new Error("Invalid recipient address");
      }

      // Ensure we have an attestation
      let currentAttestation = attestation;
      if (!currentAttestation) {
        currentAttestation = await requestAttestation();
        if (!currentAttestation) {
          throw new Error("Failed to obtain KYC attestation from Oracle");
        }
      }

      // Calculate amount and check travel rule threshold
      const amountNum = parseFloat(amount);
      const amountLamports = Math.floor(amountNum * 1_000_000); // 6 decimals
      const requiresTravelRule = amountLamports >= TRAVEL_RULE_THRESHOLD;

      // Prepare Travel Rule payload if needed
      let encryptedPayload: string | null = null;
      if (requiresTravelRule && originatorName && beneficiaryName) {
        const travelRuleData: TravelRulePayload = {
          originatorName,
          originatorAccount: publicKey.toBase58(),
          beneficiaryName,
          beneficiaryAccount: recipient,
          purpose: purpose || "Payment",
          timestamp: Date.now(),
        };
        // In production, encrypt with recipient VASP's X25519 key
        // For now, we'll just JSON encode it for the memo
        encryptedPayload = JSON.stringify(travelRuleData);
        console.log("Travel Rule Payload:", travelRuleData);
      }

      if (demoMode) {
        // ===== DEMO MODE: Simple SOL transfer =====
        const solAmount = Math.min(amountNum, 0.001);

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: recipientPubkey,
            lamports: Math.floor(solAmount * LAMPORTS_PER_SOL),
          })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, "confirmed");

        setTxResult({ signature, success: true });
        console.log("=== Demo Transfer Complete ===");
        console.log("Attestation:", currentAttestation);
        console.log("Travel Rule Required:", requiresTravelRule);

      } else {
        // ===== PRODUCTION MODE: Full SCL compliant transfer =====
        if (!program) {
          throw new Error(
            "SCL program not initialized. Make sure you've deployed the program and updated SCL_PROGRAM_ID."
          );
        }

        if (!tokenMint) {
          throw new Error("Token mint address is required for production transfers");
        }

        const mint = new PublicKey(tokenMint);

        // Get oracle public key
        const healthResponse = await fetch(`${ORACLE_URL}/health`);
        const healthData = await healthResponse.json();
        const oraclePubkey = new PublicKey(healthData.oracle_pubkey);
        const oraclePubkeyBytes = oraclePubkey.toBytes();

        // Derive PDAs
        const [registryPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("vasp_registry")],
          SCL_PROGRAM_ID
        );
        const [revocationListPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("revocation_list")],
          SCL_PROGRAM_ID
        );

        // Get token accounts (ATA)
        const [senderAta] = PublicKey.findProgramAddressSync(
          [publicKey.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), mint.toBuffer()],
          new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
        );
        const [recipientAta] = PublicKey.findProgramAddressSync(
          [recipientPubkey.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), mint.toBuffer()],
          new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
        );

        // Build Ed25519 signature verification instruction
        const attestationSignature = Buffer.from(currentAttestation.signature, "base64");
        const messagePreimage = Buffer.alloc(41);
        messagePreimage.set(publicKey.toBytes(), 0);
        const expiryBuf = Buffer.alloc(8);
        expiryBuf.writeBigInt64LE(BigInt(currentAttestation.expiry), 0);
        messagePreimage.set(expiryBuf, 32);
        messagePreimage.writeUInt8(currentAttestation.level, 40);
        const messageHash = sha256(messagePreimage);

        const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
          publicKey: oraclePubkeyBytes,
          message: Buffer.from(messageHash),
          signature: attestationSignature,
        });

        // Build memo instruction if travel rule applies
        const instructions = [ed25519Ix];

        if (encryptedPayload) {
          instructions.push({
            keys: [{ pubkey: publicKey, isSigner: true, isWritable: false }],
            programId: MEMO_PROGRAM_ID,
            data: Buffer.from(encryptedPayload, "utf-8"),
          });
        }

        // Build transfer_compliant instruction
        const transferIx = await (program.methods as any)
          .transferCompliant(
            new BN(amountLamports),
            6, // decimals
            publicKey,
            new BN(currentAttestation.expiry),
            currentAttestation.level
          )
          .accounts({
            registry: registryPda,
            sender: publicKey,
            senderTokenAccount: senderAta,
            recipientTokenAccount: recipientAta,
            mint: mint,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
            revocationList: revocationListPda,
          })
          .instruction();

        instructions.push(transferIx);

        // Build versioned transaction
        const { blockhash } = await connection.getLatestBlockhash();
        const messageV0 = new TransactionMessage({
          payerKey: publicKey,
          recentBlockhash: blockhash,
          instructions,
        }).compileToV0Message();

        const tx = new VersionedTransaction(messageV0);
        const signature = await sendTransaction(tx, connection);
        await connection.confirmTransaction(signature, "confirmed");

        setTxResult({ signature, success: true });
        console.log("=== Compliant Transfer Complete ===");
        console.log("Transaction:", signature);
      }
    } catch (err: any) {
      console.error("Transfer error:", err);
      setTxError(err.message);
    } finally {
      setTxLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    background: "#0f1117",
    border: "1px solid #2a2a3e",
    borderRadius: 6,
    color: "#e1e1e6",
    fontSize: 14,
    marginBottom: 12,
    outline: "none",
  };

  const labelStyle = {
    display: "block",
    fontSize: 12,
    color: "#8888aa",
    marginBottom: 4,
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 20 }}>Compliant Transfer</h2>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#888" }}>
          <input
            type="checkbox"
            checked={demoMode}
            onChange={(e) => setDemoMode(e.target.checked)}
            style={{ accentColor: "#6366f1" }}
          />
          Demo Mode (SOL)
        </label>
      </div>

      {demoMode ? (
        <div style={{
          padding: 12,
          background: "#1a2744",
          border: "1px solid #2a4a6e",
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          color: "#8ab4f8",
        }}>
          <strong>Demo Mode:</strong> Sends SOL (max 0.001) to test wallet interaction.
          Full compliance flow logged to console.
        </div>
      ) : !programReady ? (
        <div style={{
          padding: 12,
          background: "#442a1a",
          border: "1px solid #6e4a2a",
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          color: "#f8b48a",
        }}>
          <strong>Production Mode:</strong> SCL program not deployed.
          Run <code>scripts/deploy-devnet.sh</code> to deploy.
        </div>
      ) : (
        <div style={{
          padding: 12,
          background: "#1a442a",
          border: "1px solid #2a6e4a",
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          color: "#8af8b4",
        }}>
          <strong>Production Mode:</strong> Full on-chain compliant transfers enabled.
        </div>
      )}

      <AttestationBadge
        attestation={attestation}
        loading={attLoading}
        error={attError}
        onRequest={() => requestAttestation()}
      />

      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>Recipient Address</label>
        <input
          style={inputStyle}
          placeholder="Recipient wallet address"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          required
        />

        {!demoMode && (
          <>
            <label style={labelStyle}>Token Mint (Token-2022)</label>
            <input
              style={inputStyle}
              placeholder="Token mint address"
              value={tokenMint}
              onChange={(e) => setTokenMint(e.target.value)}
              required={!demoMode}
            />
          </>
        )}

        <label style={labelStyle}>Amount {demoMode ? "(SOL - max 0.001)" : "(tokens)"}</label>
        <input
          style={inputStyle}
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          min="0"
          step="0.000001"
        />

        <div style={{
          border: "1px solid #2a2a3e",
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          background: "#1a1a2e",
        }}>
          <h4 style={{ fontSize: 13, color: "#8888aa", marginBottom: 12 }}>
            Travel Rule Information
            <span style={{ fontWeight: 400, marginLeft: 8, color: "#666" }}>
              (Required for transfers ≥ 1000 USDC)
            </span>
          </h4>

          <label style={labelStyle}>Originator Name</label>
          <input
            style={inputStyle}
            placeholder="Your name"
            value={originatorName}
            onChange={(e) => setOriginatorName(e.target.value)}
          />

          <label style={labelStyle}>Beneficiary Name</label>
          <input
            style={inputStyle}
            placeholder="Recipient name"
            value={beneficiaryName}
            onChange={(e) => setBeneficiaryName(e.target.value)}
          />

          <label style={labelStyle}>Purpose</label>
          <input
            style={inputStyle}
            placeholder="Payment purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={txLoading || !attestation || (!demoMode && !programReady)}
          style={{
            width: "100%",
            padding: "12px",
            background: (attestation && (demoMode || programReady)) ? "#6366f1" : "#333",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 16,
            fontWeight: 600,
            cursor: (txLoading || !attestation || (!demoMode && !programReady)) ? "not-allowed" : "pointer",
          }}
        >
          {txLoading ? "Processing..." : `Send ${demoMode ? "Demo" : "Compliant"} Transfer`}
        </button>
      </form>

      <StatusDisplay result={txResult} error={txError} loading={txLoading} />

      {txResult && (
        <div style={{ marginTop: 16, fontSize: 13 }}>
          <a
            href={`https://explorer.solana.com/tx/${txResult.signature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#6366f1" }}
          >
            View on Solana Explorer →
          </a>
        </div>
      )}
    </div>
  );
}
