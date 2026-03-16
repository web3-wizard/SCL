import nacl from "tweetnacl";
import { Keypair } from "@solana/web3.js";

/**
 * Mock Fireblocks client for local testing.
 * Simulates the Fireblocks Raw Signing API using a local Ed25519 keypair.
 */
export class FireblocksMockClient {
  private keypair: Keypair;

  constructor(keypair: Keypair) {
    this.keypair = keypair;
  }

  async rawSign(messageHash: Uint8Array): Promise<Buffer> {
    // Simulate network latency
    await new Promise((r) => setTimeout(r, 100));
    const signature = nacl.sign.detached(messageHash, this.keypair.secretKey);
    return Buffer.from(signature);
  }

  async getPublicKey(): Promise<string> {
    return this.keypair.publicKey.toBase58();
  }
}
