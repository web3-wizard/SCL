import { useState } from "react";
import { useTravelRule } from "../hooks/useTravelRule";
import tweetnaclUtil from "tweetnacl-util";
const decodeBase64 = tweetnaclUtil.decodeBase64;

export function ReceiverDashboard() {
  const { decryptedPayload, error, decrypt } = useTravelRule();
  const [encryptedInput, setEncryptedInput] = useState("");
  const [secretKeyInput, setSecretKeyInput] = useState("");

  const handleDecrypt = () => {
    if (!encryptedInput || !secretKeyInput) return;

    try {
      const secretKeyBytes = decodeBase64(secretKeyInput);
      decrypt(encryptedInput, secretKeyBytes);
    } catch (err: any) {
      console.error("Decryption error:", err);
    }
  };

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
      <h2 style={{ marginBottom: 20, fontSize: 20 }}>
        Receiver Dashboard
      </h2>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        Decrypt Travel Rule payloads from incoming compliant transfers.
      </p>

      <label style={labelStyle}>Encrypted Payload (base64 from memo)</label>
      <textarea
        style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
        placeholder="Paste the base64-encoded memo data here"
        value={encryptedInput}
        onChange={(e) => setEncryptedInput(e.target.value)}
      />

      <label style={labelStyle}>VASP X25519 Secret Key (base64)</label>
      <input
        style={inputStyle}
        type="password"
        placeholder="Your VASP decryption secret key"
        value={secretKeyInput}
        onChange={(e) => setSecretKeyInput(e.target.value)}
      />

      <button
        onClick={handleDecrypt}
        disabled={!encryptedInput || !secretKeyInput}
        style={{
          width: "100%",
          padding: "12px",
          background: "#6366f1",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 600,
          cursor:
            !encryptedInput || !secretKeyInput ? "not-allowed" : "pointer",
          marginBottom: 16,
        }}
      >
        Decrypt Payload
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
            Decrypted Travel Rule Data
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
                    }}
                  >
                    {key}
                  </td>
                  <td style={{ padding: "4px 0" }}>{String(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
