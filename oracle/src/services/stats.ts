export class StatsTracker {
  private startTime = Date.now();
  private counters = {
    attestationsIssued: 0,
    attestationsByLevel: {} as Record<number, number>,
    merkleProofsServed: 0,
    merkleWalletsAdded: 0,
    merkleWalletsRemoved: 0,
  };

  recordAttestation(level: number): void {
    this.counters.attestationsIssued++;
    this.counters.attestationsByLevel[level] =
      (this.counters.attestationsByLevel[level] || 0) + 1;
  }

  recordMerkleProofServed(): void {
    this.counters.merkleProofsServed++;
  }

  recordMerkleWalletAdded(): void {
    this.counters.merkleWalletsAdded++;
  }

  recordMerkleWalletRemoved(): void {
    this.counters.merkleWalletsRemoved++;
  }

  getStats() {
    return {
      uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
      attestations_issued: this.counters.attestationsIssued,
      attestations_by_level: this.counters.attestationsByLevel,
      merkle_proofs_served: this.counters.merkleProofsServed,
      merkle_wallets_added: this.counters.merkleWalletsAdded,
      merkle_wallets_removed: this.counters.merkleWalletsRemoved,
    };
  }
}

// Singleton instance
export const stats = new StatsTracker();
