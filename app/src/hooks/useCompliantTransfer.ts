import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { buildCompliantTransferTransaction } from "../utils/transaction";
import { Attestation } from "../utils/attestation";

export interface TransferResult {
  signature: string;
  success: boolean;
}

export function useCompliantTransfer(program: any) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TransferResult | null>(null);

  const transfer = useCallback(
    async (
      recipientTokenAccount: PublicKey,
      mint: PublicKey,
      amount: bigint,
      decimals: number,
      oraclePublicKeyBytes: Uint8Array,
      attestation: Attestation,
      encryptedTravelRule: string | null
    ) => {
      if (!publicKey || !program) {
        setError("Wallet not connected or program not loaded");
        return null;
      }

      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const senderTokenAccount = PublicKey.findProgramAddressSync(
          [
            publicKey.toBuffer(),
            new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb").toBuffer(),
            mint.toBuffer(),
          ],
          new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
        )[0];

        const signatureBytes = Buffer.from(attestation.signature, "base64");

        const tx = await buildCompliantTransferTransaction(
          connection,
          program,
          publicKey,
          senderTokenAccount,
          recipientTokenAccount,
          mint,
          amount,
          decimals,
          oraclePublicKeyBytes,
          signatureBytes,
          attestation.expiry,
          attestation.level,
          encryptedTravelRule
        );

        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");

        const transferResult = { signature: sig, success: true };
        setResult(transferResult);
        return transferResult;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, program, connection, sendTransaction]
  );

  return { transfer, loading, error, result };
}
