import { sha256 } from "@noble/hashes/sha256";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import { oracleKeypair } from "../keypair";
import { getFireblocksClient } from "./fireblocks";
import { Attestation } from "../types";

export async function createAttestation(
  walletAddress: string,
  level: number = 1,
  validitySeconds: number = 3600
): Promise<Attestation> {
  const wallet = new PublicKey(walletAddress);
  const expiry = Math.floor(Date.now() / 1000) + validitySeconds;

  // Build message preimage: wallet(32) || expiry(8 LE) || level(1)
  const messagePreimage = Buffer.alloc(41);
  messagePreimage.set(wallet.toBytes(), 0);
  messagePreimage.writeBigInt64LE(BigInt(expiry), 32);
  messagePreimage.writeUInt8(level, 40);

  // SHA256 hash
  const messageHash = sha256(messagePreimage);

  let signature: Buffer;

  const fbClient = getFireblocksClient();
  if (fbClient) {
    // Fireblocks Raw Signing
    signature = await fbClient.rawSign(messageHash);
  } else {
    // Local Ed25519 signing
    signature = Buffer.from(
      nacl.sign.detached(messageHash, oracleKeypair.secretKey)
    );
  }

  return {
    wallet: walletAddress,
    expiry,
    level,
    signature: signature.toString("base64"),
  };
}
