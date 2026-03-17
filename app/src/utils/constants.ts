import { PublicKey } from "@solana/web3.js";

// SCL Program ID - set via environment variable or defaults to placeholder
export const SCL_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_SCL_PROGRAM_ID || "11111111111111111111111111111111"
);

export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);

// Oracle URL - set via environment variable for production
export const ORACLE_URL = import.meta.env.VITE_ORACLE_URL || "http://localhost:3001";

// Solana cluster
export const SOLANA_CLUSTER = import.meta.env.VITE_SOLANA_CLUSTER || "devnet";

// Travel Rule threshold in smallest token units (1000 USDC with 6 decimals)
export const TRAVEL_RULE_THRESHOLD = 1_000_000_000;
