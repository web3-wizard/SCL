interface StatusDisplayProps {
  result: { signature: string; success: boolean } | null;
  error: string | null;
  loading: boolean;
}

export function StatusDisplay({ result, error, loading }: StatusDisplayProps) {
  if (loading) {
    return (
      <div
        style={{
          border: "1px solid #2a2a3e",
          borderRadius: 8,
          padding: 16,
          background: "#1a1a2e",
          marginTop: 16,
        }}
      >
        <p style={{ color: "#a5b4fc" }}>Sending compliant transfer...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          border: "1px solid #7f1d1d",
          borderRadius: 8,
          padding: 16,
          background: "#1c1017",
          marginTop: 16,
        }}
      >
        <h4 style={{ color: "#f87171", marginBottom: 8 }}>Transfer Failed</h4>
        <p style={{ color: "#fca5a5", fontSize: 13, wordBreak: "break-all" }}>
          {error}
        </p>
      </div>
    );
  }

  if (result?.success) {
    return (
      <div
        style={{
          border: "1px solid #14532d",
          borderRadius: 8,
          padding: 16,
          background: "#0f1f17",
          marginTop: 16,
        }}
      >
        <h4 style={{ color: "#4ade80", marginBottom: 8 }}>
          Transfer Successful
        </h4>
        <p style={{ fontSize: 12, color: "#86efac" }}>
          Signature:{" "}
          <code style={{ wordBreak: "break-all" }}>{result.signature}</code>
        </p>
      </div>
    );
  }

  return null;
}
