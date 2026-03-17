import { useState, useCallback } from "react";
import {
  encryptTravelRule,
  decryptTravelRule,
  TravelRulePayload,
} from "../utils/encryption";

export function useTravelRule() {
  const [encryptedPayload, setEncryptedPayload] = useState<string | null>(null);
  const [decryptedPayload, setDecryptedPayload] =
    useState<TravelRulePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const encrypt = useCallback(
    (payload: TravelRulePayload, recipientVaspKey: Uint8Array) => {
      try {
        const encrypted = encryptTravelRule(payload, recipientVaspKey);
        setEncryptedPayload(encrypted);
        setError(null);
        return encrypted;
      } catch (err: any) {
        setError(err.message);
        return null;
      }
    },
    []
  );

  const decrypt = useCallback(
    (encryptedBase64: string, secretKey: Uint8Array) => {
      try {
        const payload = decryptTravelRule(encryptedBase64, secretKey);
        setDecryptedPayload(payload);
        setError(null);
        return payload;
      } catch (err: any) {
        setError(err.message);
        return null;
      }
    },
    []
  );

  return { encryptedPayload, decryptedPayload, error, encrypt, decrypt, setDecryptedPayload, setError };
}
