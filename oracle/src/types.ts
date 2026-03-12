export interface Attestation {
  wallet: string;
  expiry: number;
  level: number;
  signature: string;
}

export interface AttestRequest {
  wallet: string;
  level?: number;
}
