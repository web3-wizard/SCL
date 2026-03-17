import { useState } from "react";
import { useTravelRule } from "../hooks/useTravelRule";
import tweetnaclUtil from "tweetnacl-util";
const decodeBase64 = tweetnaclUtil.decodeBase64;

export function ReceiverDashboard() {
  const { decryptedPayload, error, decrypt, setDecryptedPayload, setError } = useTravelRule();
  const [encryptedInput, setEncryptedInput] = useState("");
  const [secretKeyInput, setSecretKeyInput] = useState("");
  const [demoMode, setDemoMode] = useState(true);

  const handleDecrypt = () => {
    if (!encryptedInput) return;

    if (demoMode) {
      // Demo mode: payload is plain JSON
      try {
        const parsed = JSON.parse(encryptedInput);
        setDecryptedPayload(parsed);
        setError(null);
      } catch (err: any) {
        setError("Invalid JSON payload. Make sure you paste valid Travel Rule JSON.");
      }
    } else {
      // Production mode: payload is encrypted
      if (!secretKeyInput) {
        setError("Secret key required for encrypted payloads");
        return;
      }
      try {
        const secretKeyBytes = decodeBase64(secretKeyInput);
        decrypt(encryptedInput, secretKeyBytes);
      } catch (err: any) {
        console.error("Decryption error:", err);
        setError("Decryption failed. Check your secret key and payload.");
      }
    }
  };

  // Sample demo payload for testing
  const samplePayload = JSON.stringify({
    originatorName: "John Doe",
    originatorAccount: "8C1fLhLT8ajhx9p2tkKHdy6RpNLdAEBmqEBnurYFPDGR",
    beneficiaryName: "Jane Smith",
    beneficiaryAccount: "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV",
    purpose: "Demo Transfer",
    timestamp: Date.now()
  }, null, 2);

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    background: "#0f1117",
    border: "1px solid #2a2a3e",
    borderRadius: 6,
    color: "#e1e1e6",
    fontSize: 13,
    marginBottom: 12,
    outline: "none",
    fontFamily: "monospace",
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
        <h2 style={{ fontSize: 20 }}>Receiver Dashboard</h2>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#888" }}>
          <input
            type="checkbox"
            checked={demoMode}
            onChange={(e) => setDemoMode(e.target.checked)}
            style={{ accentColor: "#6366f1" }}
          />
          Demo Mode (JSON)
        </label>
      </div>

      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        {demoMode
          ? "Parse Travel Rule JSON payloads from demo transfers."
          : "Decrypt encrypted Travel Rule payloads from compliant transfers."
        }
      </p>

      {demoMode && (
        <div style={{
          padding: 12,
          background: "#1a2744",
          border: "1px solid #2a4a6e",
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          color: "#8ab4f8",
        }}>
          <strong>Demo Mode:</strong> Paste JSON payload directly.
          <button
            onClick={() => setEncryptedInput(samplePayload)}
            style={{
              marginLeft: 8,
              padding: "4px 8px",
              background: "#2a4a6e",
              border: "none",
              borderRadius: 4,
              color: "#8ab4f8",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Load Sample
          </button>
        </div>
      )}

      <label style={labelStyle}>
        {demoMode ? "Travel Rule Payload (JSON)" : "Encrypted Payload (base64 from memo)"}
      </label>
      <textarea
        style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
        placeholder={demoMode
          ? "Paste the JSON Travel Rule payload here"
          : "Paste the base64-encoded memo data here"
        }
        value={encryptedInput}
        onChange={(e) => setEncryptedInput(e.target.value)}
      />

      {!demoMode && (
        <>
          <label style={labelStyle}>VASP X25519 Secret Key (base64)</label>
          <input
            style={inputStyle}
            type="password"
            placeholder="Your VASP decryption secret key"
            value={secretKeyInput}
            onChange={(e) => setSecretKeyInput(e.target.value)}
          />
        </>
      )}

      <button
        onClick={handleDecrypt}
        disabled={!encryptedInput || (!demoMode && !secretKeyInput)}
        style={{
          width: "100%",
          padding: "12px",
          background: encryptedInput && (demoMode || secretKeyInput) ? "#6366f1" : "#333",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 600,
          cursor: !encryptedInput || (!demoMode && !secretKeyInput) ? "not-allowed" : "pointer",
          marginBottom: 16,
        }}
      >
        {demoMode ? "Parse Payload" : "Decrypt Payload"}
      </button>

      {error && (
        <div
          style={{
            border: "1px solid #7f1d1d",
            borderRadius: 8,
            padding: 16,
            background: "#1c1017",
            marginBottom: 16,
          }}
        >
          <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>
        </div>
      )}

      {decryptedPayload && (
        <div
          style={{
            border: "1px solid #14532d",
            borderRadius: 8,
            padding: 16,
            background: "#0f1f17",
          }}
        >
          <h4 style={{ color: "#4ade80", marginBottom: 12 }}>
            Travel Rule Data
          </h4>
          <table style={{ width: "100%", fontSize: 13, color: "#e1e1e6" }}>
            <tbody>
              {Object.entries(decryptedPayload).map(([key, value]) => (
                <tr key={key}>
                  <td
                    style={{
                      padding: "4px 8px 4px 0",
                      color: "#8888aa",
                      verticalAlign: "top",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {key}
                  </td>
                  <td style={{ padding: "4px 0", wordBreak: "break-all" }}>
                    {key === "timestamp"
                      ? new Date(Number(value)).toLocaleString()
                      : String(value)
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
