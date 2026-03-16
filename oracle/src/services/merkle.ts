import { keccak_256 } from "@noble/hashes/sha3";
import { PublicKey } from "@solana/web3.js";

export class MerkleTree {
  private leaves: Buffer[] = [];

  addWallet(wallet: string): void {
    const pubkey = new PublicKey(wallet);
    const leaf = Buffer.from(keccak_256(pubkey.toBytes()));
    // Avoid duplicates
    if (!this.leaves.some((l) => l.equals(leaf))) {
      this.leaves.push(leaf);
    }
  }

  removeWallet(wallet: string): boolean {
    const pubkey = new PublicKey(wallet);
    const leaf = Buffer.from(keccak_256(pubkey.toBytes()));
    const index = this.leaves.findIndex((l) => l.equals(leaf));
    if (index === -1) return false;
    this.leaves.splice(index, 1);
    return true;
  }

  getRoot(): Buffer {
    if (this.leaves.length === 0) {
      return Buffer.alloc(32);
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
    return layer[0];
  }

  getProof(wallet: string): Buffer[] {
    const pubkey = new PublicKey(wallet);
    const leaf = Buffer.from(keccak_256(pubkey.toBytes()));
    const index = this.leaves.findIndex((l) => l.equals(leaf));
    if (index === -1) return [];

    const proof: Buffer[] = [];
    let layer = [...this.leaves];
    let idx = index;

    while (layer.length > 1) {
      const nextLayer: Buffer[] = [];
      for (let i = 0; i < layer.length; i += 2) {
        if (i + 1 < layer.length) {
          if (i === idx || i + 1 === idx) {
            const sibling = i === idx ? layer[i + 1] : layer[i];
            proof.push(sibling);
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

  hasWallet(wallet: string): boolean {
    const pubkey = new PublicKey(wallet);
    const leaf = Buffer.from(keccak_256(pubkey.toBytes()));
    return this.leaves.some((l) => l.equals(leaf));
  }
}

/**
 * Sorted-pair keccak256 hashing — matches on-chain convention.
 * The smaller value always comes first.
 */
function hashPair(a: Buffer, b: Buffer): Buffer {
  if (Buffer.compare(a, b) <= 0) {
    return Buffer.from(keccak_256(Buffer.concat([a, b])));
  } else {
    return Buffer.from(keccak_256(Buffer.concat([b, a])));
  }
}

// Singleton instance
export const merkleTree = new MerkleTree();
