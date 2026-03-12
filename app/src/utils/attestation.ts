import { ORACLE_URL } from "./constants";

export interface Attestation {
  wallet: string;
  expiry: number;
  level: number;
  signature: string;
}

export async function fetchAttestation(
  walletAddress: string,
  level: number = 1
): Promise<Attestation> {
  const response = await fetch(`${ORACLE_URL}/attest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet: walletAddress, level }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Failed to fetch attestation");
  }

  return response.json();
}
