import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { fetchAttestation, Attestation } from "../utils/attestation";

export function useAttestation() {
  const { publicKey } = useWallet();
  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestAttestation = useCallback(
    async (level: number = 1) => {
      if (!publicKey) {
        setError("Wallet not connected");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const att = await fetchAttestation(publicKey.toBase58(), level);
        setAttestation(att);
        return att;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [publicKey]
  );

  const clearAttestation = useCallback(() => {
    setAttestation(null);
    setError(null);
  }, []);

  return { attestation, loading, error, requestAttestation, clearAttestation };
}
