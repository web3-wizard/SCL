export interface Attestation {
  wallet: string;
  expiry: number;
  level: number;
  signature: string;
}

export interface AttestRequest {
  wallet: string;
  level?: number;
}

export interface MerkleProofResponse {
  wallet: string;
  proof: number[][];
  root: number[];
}

export interface OracleStats {
  uptime_seconds: number;
  attestations_issued: number;
  attestations_by_level: Record<number, number>;
  merkle_proofs_served: number;
  merkle_wallets_added: number;
  merkle_wallets_removed: number;
}
