interface AttestationBadgeProps {
  attestation: {
    wallet: string;
    expiry: number;
    level: number;
  } | null;
  loading: boolean;
  error: string | null;
  onRequest: () => void;
}

export function AttestationBadge({
  attestation,
  loading,
  error,
  onRequest,
}: AttestationBadgeProps) {
  const isExpired = attestation
    ? attestation.expiry * 1000 < Date.now()
    : false;

  return (
    <div
      style={{
        border: "1px solid #2a2a3e",
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        background: "#1a1a2e",
      }}
    >
      <h3 style={{ marginBottom: 8, fontSize: 14, color: "#8888aa" }}>
        KYC/AML Attestation
      </h3>

      {attestation && !isExpired ? (
        <div>
          <div
            style={{
              display: "inline-block",
              background: "#1a4d2e",
              color: "#4ade80",
              padding: "4px 12px",
              borderRadius: 16,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Verified (Level {attestation.level})
          </div>
          <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
            Expires:{" "}
            {new Date(attestation.expiry * 1000).toLocaleString()}
          </p>
        </div>
      ) : (
        <div>
          {isExpired && (
            <p style={{ color: "#f87171", fontSize: 13, marginBottom: 8 }}>
              Attestation expired
            </p>
          )}
          {error && (
            <p style={{ color: "#f87171", fontSize: 13, marginBottom: 8 }}>
              {error}
            </p>
          )}
          <button
            onClick={onRequest}
            disabled={loading}
            style={{
              background: "#6366f1",
              color: "#fff",
              border: "none",
              padding: "8px 16px",
              borderRadius: 6,
              cursor: loading ? "wait" : "pointer",
              fontSize: 14,
            }}
          >
            {loading ? "Requesting..." : "Request KYC Attestation"}
          </button>
        </div>
      )}
    </div>
  );
}
