import { PublicKey } from "@solana/web3.js";
import { keccak_256 } from "@noble/hashes/sha3";

/**
 * Simple Merkle tree for tests. Uses keccak256 with sorted-pair hashing
 * to match the on-chain convention.
 */
export class TestMerkleTree {
  private leaves: Buffer[] = [];

  addWallet(wallet: PublicKey): void {
    const leaf = Buffer.from(keccak_256(wallet.toBytes()));
    this.leaves.push(leaf);
  }

  getRoot(): number[] {
    if (this.leaves.length === 0) {
      return Array.from(Buffer.alloc(32));
    }
    let layer = [...this.leaves];
    while (layer.length > 1) {
      const nextLayer: Buffer[] = [];
      for (let i = 0; i < layer.length; i += 2) {
        if (i + 1 < layer.length) {
          nextLayer.push(hashPair(layer[i], layer[i + 1]));
        } else {
          nextLayer.push(layer[i]);
        }
      }
      layer = nextLayer;
    }
    return Array.from(layer[0]);
  }

  getProof(wallet: PublicKey): number[][] {
    const leaf = Buffer.from(keccak_256(wallet.toBytes()));
    const index = this.leaves.findIndex((l) => l.equals(leaf));
    if (index === -1) return [];

    const proof: number[][] = [];
    let layer = [...this.leaves];
    let idx = index;

    while (layer.length > 1) {
      const nextLayer: Buffer[] = [];
      for (let i = 0; i < layer.length; i += 2) {
        if (i + 1 < layer.length) {
          if (i === idx || i + 1 === idx) {
            const sibling = i === idx ? layer[i + 1] : layer[i];
            proof.push(Array.from(sibling));
          }
          nextLayer.push(hashPair(layer[i], layer[i + 1]));
        } else {
          nextLayer.push(layer[i]);
        }
      }
      idx = Math.floor(idx / 2);
      layer = nextLayer;
    }

    return proof;
  }

  getSize(): number {
    return this.leaves.length;
  }
}

function hashPair(a: Buffer, b: Buffer): Buffer {
  if (Buffer.compare(a, b) <= 0) {
    return Buffer.from(keccak_256(Buffer.concat([a, b])));
  } else {
    return Buffer.from(keccak_256(Buffer.concat([b, a])));
  }
}
