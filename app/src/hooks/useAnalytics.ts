import { useState, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { ORACLE_URL } from "../utils/constants";
import { getRegistryPda, getRevocationListPda } from "../utils/transaction";

export interface AnalyticsData {
  // Oracle stats
  oracleUptime: number;
  attestationsIssued: number;
  attestationsByLevel: Record<number, number>;
  merkleProofsServed: number;
  merkleWalletsAdded: number;
  merkleWalletsRemoved: number;
  // On-chain stats
  vaspCount: number;
  oracleCount: number;
  revokedCount: number;
  travelRuleThreshold: number;
  // Merkle tree
  merkleTreeSize: number;
  // Meta
  loading: boolean;
  error: string | null;
}

const initialData: AnalyticsData = {
  oracleUptime: 0,
  attestationsIssued: 0,
  attestationsByLevel: {},
  merkleProofsServed: 0,
  merkleWalletsAdded: 0,
  merkleWalletsRemoved: 0,
  vaspCount: 0,
  oracleCount: 0,
  revokedCount: 0,
  travelRuleThreshold: 0,
  merkleTreeSize: 0,
  loading: false,
  error: null,
};

export function useAnalytics() {
  const { connection } = useConnection();
  const [data, setData] = useState<AnalyticsData>(initialData);

  const refresh = useCallback(async () => {
    setData((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Fetch oracle stats and merkle root in parallel
      const [statsRes, merkleRes] = await Promise.allSettled([
        fetch(`${ORACLE_URL}/stats`).then((r) => r.json()),
        fetch(`${ORACLE_URL}/merkle/root`).then((r) => r.json()),
      ]);

      const oracleStats =
        statsRes.status === "fulfilled" ? statsRes.value : null;
      const merkleRoot =
        merkleRes.status === "fulfilled" ? merkleRes.value : null;

      // Fetch on-chain registry + revocation list
      let vaspCount = 0;
      let oracleCount = 0;
      let travelRuleThreshold = 0;
      let revokedCount = 0;

      try {
        const registryPda = getRegistryPda();
        const registryInfo = await connection.getAccountInfo(registryPda);
        if (registryInfo) {
          // Parse anchor discriminator (8 bytes) + owner (32) + travel_rule_threshold (8)
          // + vasp_count (4) + oracle count from vec length
          const dataView = new DataView(registryInfo.data.buffer);
          travelRuleThreshold = Number(dataView.getBigUint64(40, true));
          vaspCount = dataView.getUint32(48, true);
          // Oracle count: after vasp entries, read vec length
          // For simplicity, just show basic counts
        }
      } catch {
        // Ignore on-chain fetch errors
      }

      try {
        const revocationPda = getRevocationListPda();
        const revInfo = await connection.getAccountInfo(revocationPda);
        if (revInfo) {
          const dataView = new DataView(revInfo.data.buffer);
          // discriminator (8) + authority (32) + revocation_count (u32 at offset 40)
          revokedCount = dataView.getUint32(40, true);
        }
      } catch {
        // Ignore on-chain fetch errors
      }

      setData({
        oracleUptime: oracleStats?.uptime_seconds ?? 0,
        attestationsIssued: oracleStats?.attestations_issued ?? 0,
        attestationsByLevel: oracleStats?.attestations_by_level ?? {},
        merkleProofsServed: oracleStats?.merkle_proofs_served ?? 0,
        merkleWalletsAdded: oracleStats?.merkle_wallets_added ?? 0,
        merkleWalletsRemoved: oracleStats?.merkle_wallets_removed ?? 0,
        vaspCount,
        oracleCount,
        revokedCount,
        travelRuleThreshold,
        merkleTreeSize: merkleRoot?.tree_size ?? 0,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setData((prev) => ({
        ...prev,
        loading: false,
        error: err.message || "Failed to fetch analytics",
      }));
    }
  }, [connection]);

  return { data, refresh };
}
