import { sha256 } from "@noble/hashes/sha256";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import { oracleKeypair } from "../keypair";
import { Attestation } from "../types";

export function createAttestation(
  walletAddress: string,
  level: number = 1,
  validitySeconds: number = 3600
): Attestation {
  const wallet = new PublicKey(walletAddress);
  const expiry = Math.floor(Date.now() / 1000) + validitySeconds;

  // Build message preimage: wallet(32) || expiry(8 LE) || level(1)
  const messagePreimage = Buffer.alloc(41);
  messagePreimage.set(wallet.toBytes(), 0);
  messagePreimage.writeBigInt64LE(BigInt(expiry), 32);
  messagePreimage.writeUInt8(level, 40);

  // SHA256 hash then sign with Ed25519
  const messageHash = sha256(messagePreimage);
  const signature = nacl.sign.detached(messageHash, oracleKeypair.secretKey);

  return {
    wallet: walletAddress,
    expiry,
    level,
    signature: Buffer.from(signature).toString("base64"),
  };
}
