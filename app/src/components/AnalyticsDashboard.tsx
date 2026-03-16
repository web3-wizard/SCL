import { useEffect } from "react";
import { useAnalytics } from "../hooks/useAnalytics";

export function AnalyticsDashboard() {
  const { data, refresh } = useAnalytics();

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Analytics Dashboard</h2>
        <button
          onClick={refresh}
          disabled={data.loading}
          style={{
            padding: "8px 16px",
            background: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: data.loading ? "not-allowed" : "pointer",
            opacity: data.loading ? 0.6 : 1,
            fontSize: 13,
          }}
        >
          {data.loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {data.error && (
        <div
          style={{
            padding: 12,
            background: "#3b1c1c",
            border: "1px solid #7f1d1d",
            borderRadius: 8,
            color: "#fca5a5",
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          {data.error}
        </div>
      )}

      {/* Metric Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <MetricCard
          label="Attestations Issued"
          value={data.attestationsIssued}
        />
        <MetricCard label="Registered VASPs" value={data.vaspCount} />
        <MetricCard label="Revoked Wallets" value={data.revokedCount} />
        <MetricCard label="Merkle Tree Wallets" value={data.merkleTreeSize} />
      </div>

      {/* Attestations by KYC Level */}
      <Section title="Attestations by KYC Level">
        <LevelChart levels={data.attestationsByLevel} />
      </Section>

      {/* Merkle Tree Stats */}
      <Section title="Merkle Tree">
        <StatRow label="Proofs Served" value={data.merkleProofsServed} />
        <StatRow label="Wallets Added" value={data.merkleWalletsAdded} />
        <StatRow label="Wallets Removed" value={data.merkleWalletsRemoved} />
        <StatRow label="Current Size" value={data.merkleTreeSize} />
      </Section>

      {/* System Info */}
      <Section title="System Info">
        <StatRow label="Oracle Uptime" value={formatUptime(data.oracleUptime)} />
        <StatRow
          label="Travel Rule Threshold"
          value={
            data.travelRuleThreshold > 0
              ? `${data.travelRuleThreshold / 1_000_000} rUSDC`
              : "N/A"
          }
        />
      </Section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: "#1a1a2e",
        border: "1px solid #2a2a3e",
        borderRadius: 8,
        padding: 20,
      }}
    >
      <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#e1e1e6" }}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#1a1a2e",
        border: "1px solid #2a2a3e",
        borderRadius: 8,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <h3
        style={{
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 12,
          color: "#a5a5b5",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function StatRow({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "6px 0",
        borderBottom: "1px solid #2a2a3e",
        fontSize: 13,
      }}
    >
      <span style={{ color: "#888" }}>{label}</span>
      <span style={{ fontWeight: 500 }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </div>
  );
}

function LevelChart({ levels }: { levels: Record<number, number> }) {
  const entries = Object.entries(levels).map(([k, v]) => [Number(k), v] as [number, number]);
  if (entries.length === 0) {
    return (
      <div style={{ color: "#666", fontSize: 13 }}>No attestations yet</div>
    );
  }

  const max = Math.max(...entries.map(([, v]) => v));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {entries
        .sort(([a], [b]) => a - b)
        .map(([level, count]) => (
          <div key={level} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 60, fontSize: 12, color: "#888" }}>
              Level {level}
            </span>
            <div
              style={{
                flex: 1,
                background: "#2a2a3e",
                borderRadius: 4,
                height: 20,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${(count / max) * 100}%`,
                  height: "100%",
                  background: "#6366f1",
                  borderRadius: 4,
                  minWidth: 2,
                }}
              />
            </div>
            <span style={{ width: 40, textAlign: "right", fontSize: 12 }}>
              {count}
            </span>
          </div>
        ))}
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
