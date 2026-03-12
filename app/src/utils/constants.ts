import { PublicKey } from "@solana/web3.js";

// Updated after `anchor build` — placeholder for now
export const SCL_PROGRAM_ID = new PublicKey(
  "SC1111111111111111111111111111111111111111111"
);

export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);

export const ORACLE_URL = "http://localhost:3001";

// Travel Rule threshold in smallest token units (1000 rUSDC with 6 decimals)
export const TRAVEL_RULE_THRESHOLD = 1_000_000_000;
