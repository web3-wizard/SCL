import nacl from "tweetnacl";
import { encode as encodeBase64, decode as decodeBase64 } from "tweetnacl-util";

export interface TravelRulePayload {
  originatorName: string;
  originatorAccount: string;
  beneficiaryName: string;
  beneficiaryAccount: string;
  purpose: string;
  timestamp: number;
}

/**
 * Encrypt Travel Rule payload for a recipient VASP.
 * Format: [32-byte ephemeral pubkey][24-byte nonce][ciphertext]
 * Returned as base64 for inclusion in Memo instruction.
 */
export function encryptTravelRule(
  payload: TravelRulePayload,
  recipientVaspX25519PublicKey: Uint8Array
): string {
  const ephemeralKeypair = nacl.box.keyPair();
  const nonce = nacl.randomBytes(24);
  const message = new TextEncoder().encode(JSON.stringify(payload));

  const ciphertext = nacl.box(
    message,
    nonce,
    recipientVaspX25519PublicKey,
    ephemeralKeypair.secretKey
  );

  if (!ciphertext) {
    throw new Error("Encryption failed");
  }

  // Pack: [ephemeral_pubkey(32)][nonce(24)][ciphertext(variable)]
  const packed = new Uint8Array(32 + 24 + ciphertext.length);
  packed.set(ephemeralKeypair.publicKey, 0);
  packed.set(nonce, 32);
  packed.set(ciphertext, 56);

  return encodeBase64(packed);
}

/**
 * Decrypt Travel Rule payload (receiver VASP side).
 */
export function decryptTravelRule(
  encryptedBase64: string,
  recipientVaspX25519SecretKey: Uint8Array
): TravelRulePayload {
  const packed = decodeBase64(encryptedBase64);

  const ephemeralPubkey = packed.slice(0, 32);
  const nonce = packed.slice(32, 56);
  const ciphertext = packed.slice(56);

  const decrypted = nacl.box.open(
    ciphertext,
    nonce,
    ephemeralPubkey,
    recipientVaspX25519SecretKey
  );

  if (!decrypted) {
    throw new Error("Decryption failed - invalid key or corrupted data");
  }

  return JSON.parse(new TextDecoder().decode(decrypted));
}
