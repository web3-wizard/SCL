import { ORACLE_URL } from "./constants";

export interface MerkleProofResponse {
  wallet: string;
  proof: number[][];
  root: number[];
}

export async function fetchMerkleProof(
  wallet: string
): Promise<MerkleProofResponse> {
  const res = await fetch(`${ORACLE_URL}/merkle/proof/${wallet}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to fetch Merkle proof");
  }
  return res.json();
}

export async function addWalletToMerkleTree(wallet: string): Promise<void> {
  const res = await fetch(`${ORACLE_URL}/merkle/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to add wallet to Merkle tree");
  }
}

export async function getMerkleRoot(): Promise<{
  root: number[];
  tree_size: number;
}> {
  const res = await fetch(`${ORACLE_URL}/merkle/root`);
  if (!res.ok) {
    throw new Error("Failed to fetch Merkle root");
  }
  return res.json();
}
