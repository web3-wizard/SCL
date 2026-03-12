import { Keypair, PublicKey, Ed25519Program } from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha256";
import nacl from "tweetnacl";

export interface TestAttestation {
  messageHash: Uint8Array;
  signature: Uint8Array;
  expiry: number;
  level: number;
  ed25519Instruction: ReturnType<typeof Ed25519Program.createInstructionWithPublicKey>;
}

export function createTestAttestation(
  oracleKeypair: Keypair,
  wallet: PublicKey,
  expiry: number,
  level: number
): TestAttestation {
  // Build message preimage: wallet(32) || expiry(8 LE) || level(1)
  const preimage = Buffer.alloc(41);
  preimage.set(wallet.toBytes(), 0);
  preimage.writeBigInt64LE(BigInt(expiry), 32);
  preimage.writeUInt8(level, 40);

  const messageHash = sha256(preimage);
  const signature = nacl.sign.detached(
    messageHash,
    oracleKeypair.secretKey
  );

  const ed25519Instruction = Ed25519Program.createInstructionWithPublicKey({
    publicKey: oracleKeypair.publicKey.toBytes(),
    message: Buffer.from(messageHash),
    signature: Buffer.from(signature),
  });

  return {
    messageHash,
    signature,
    expiry,
    level,
    ed25519Instruction,
  };
}

export function createExpiredAttestation(
  oracleKeypair: Keypair,
  wallet: PublicKey,
  level: number = 1
): TestAttestation {
  // Set expiry to 1 hour ago
  const expiry = Math.floor(Date.now() / 1000) - 3600;
  return createTestAttestation(oracleKeypair, wallet, expiry, level);
}

export function createValidAttestation(
  oracleKeypair: Keypair,
  wallet: PublicKey,
  level: number = 1
): TestAttestation {
  // Set expiry to 1 hour from now
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  return createTestAttestation(oracleKeypair, wallet, expiry, level);
}
