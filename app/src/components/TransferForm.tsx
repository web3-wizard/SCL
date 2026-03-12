import { useState, FormEvent } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAttestation } from "../hooks/useAttestation";
import { AttestationBadge } from "./AttestationBadge";
import { StatusDisplay } from "./StatusDisplay";

export function TransferForm() {
  const { publicKey } = useWallet();
  const { attestation, loading: attLoading, error: attError, requestAttestation } = useAttestation();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [originatorName, setOriginatorName] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<{ signature: string; success: boolean } | null>(null);

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
      // In a full implementation, this would:
      // 1. Fetch attestation if not present
      // 2. Encrypt Travel Rule payload
      // 3. Build and send the 3-instruction transaction
      // For now, demonstrate the flow structure
      if (!attestation) {
        const att = await requestAttestation();
        if (!att) {
          setTxError("Failed to obtain attestation");
          return;
        }
      }

      // Placeholder for actual transfer logic
      // The useCompliantTransfer hook handles the real implementation
      setTxResult({
        signature: "demo-signature-placeholder",
        success: true,
      });
    } catch (err: any) {
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
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: 24,
      }}
    >
      <h2 style={{ marginBottom: 20, fontSize: 20 }}>Compliant Transfer</h2>

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

        <label style={labelStyle}>Amount (rUSDC)</label>
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

        <div
          style={{
            border: "1px solid #2a2a3e",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
            background: "#1a1a2e",
          }}
        >
          <h4 style={{ fontSize: 13, color: "#8888aa", marginBottom: 12 }}>
            Travel Rule Information
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
          disabled={txLoading || !attestation}
          style={{
            width: "100%",
            padding: "12px",
            background: attestation ? "#6366f1" : "#333",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 16,
            fontWeight: 600,
            cursor: txLoading || !attestation ? "not-allowed" : "pointer",
          }}
        >
          {txLoading ? "Processing..." : "Send Compliant Transfer"}
        </button>
      </form>

      <StatusDisplay result={txResult} error={txError} loading={txLoading} />
    </div>
  );
}
