import fs from "fs";
import crypto from "crypto";
import axios from "axios";
import jwt from "jsonwebtoken";

export interface FireblocksConfig {
  apiKey: string;
  apiSecretPath: string;
  vaultId: string;
  baseUrl?: string;
}

export class FireblocksClient {
  private apiKey: string;
  private privateKey: string;
  private vaultId: string;
  private baseUrl: string;

  constructor(config: FireblocksConfig) {
    this.apiKey = config.apiKey;
    this.privateKey = fs.readFileSync(config.apiSecretPath, "utf8");
    this.vaultId = config.vaultId;
    this.baseUrl = config.baseUrl || "https://api.fireblocks.io";
  }

  private signJwt(path: string, body?: object): string {
    const now = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomUUID();
    const payload: Record<string, any> = {
      uri: path,
      nonce,
      iat: now,
      exp: now + 30,
      sub: this.apiKey,
    };
    if (body) {
      const bodyStr = JSON.stringify(body);
      payload.bodyHash = crypto
        .createHash("sha256")
        .update(bodyStr)
        .digest("hex");
    }
    return jwt.sign(payload, this.privateKey, { algorithm: "RS256" });
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: object
  ): Promise<T> {
    const token = this.signJwt(path, body);
    const response = await axios({
      method,
      url: `${this.baseUrl}${path}`,
      headers: {
        "X-API-Key": this.apiKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: body,
    });
    return response.data;
  }

  /**
   * Sign a 32-byte hash using Fireblocks Raw Signing API (EdDSA / Ed25519).
   * Returns the 64-byte signature.
   */
  async rawSign(messageHash: Uint8Array): Promise<Buffer> {
    const content = Buffer.from(messageHash).toString("hex");

    // Create raw signing transaction
    const txPath = "/v1/transactions";
    const txBody = {
      operation: "RAW",
      source: {
        type: "VAULT_ACCOUNT",
        id: this.vaultId,
      },
      extraParameters: {
        rawMessageData: {
          messages: [
            {
              content,
              type: "SHA256", // already hashed
            },
          ],
          algorithm: "MPC_EDDSA_ED25519",
        },
      },
    };

    const createResp = await this.request<{ id: string }>(
      "POST",
      txPath,
      txBody
    );
    const txId = createResp.id;

    // Poll for completion
    const statusPath = `/v1/transactions/${txId}`;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const txStatus = await this.request<{
        status: string;
        signedMessages?: Array<{ signature: { fullSig: string } }>;
      }>("GET", statusPath);

      if (txStatus.status === "COMPLETED" && txStatus.signedMessages?.[0]) {
        const sigHex = txStatus.signedMessages[0].signature.fullSig;
        return Buffer.from(sigHex, "hex");
      }
      if (
        txStatus.status === "FAILED" ||
        txStatus.status === "REJECTED" ||
        txStatus.status === "CANCELLED"
      ) {
        throw new Error(`Fireblocks signing failed with status: ${txStatus.status}`);
      }
    }
    throw new Error("Fireblocks signing timed out");
  }

  /**
   * Fetch the Ed25519 public key from the vault.
   */
  async getPublicKey(): Promise<string> {
    const path = `/v1/vault/accounts/${this.vaultId}/SOL_TEST/0/public_key_info`;
    const resp = await this.request<{ publicKey: string }>("GET", path);
    return resp.publicKey;
  }
}

// Singleton — only created if env vars are set
let _client: FireblocksClient | null = null;

export function getFireblocksClient(): FireblocksClient | null {
  if (_client) return _client;

  const apiKey = process.env.FIREBLOCKS_API_KEY;
  const apiSecretPath = process.env.FIREBLOCKS_API_SECRET_PATH;
  const vaultId = process.env.FIREBLOCKS_VAULT_ID;

  if (apiKey && apiSecretPath && vaultId) {
    _client = new FireblocksClient({ apiKey, apiSecretPath, vaultId });
    console.log("Fireblocks signing mode enabled");
    return _client;
  }
  return null;
}

export function isFireblocksEnabled(): boolean {
  return getFireblocksClient() !== null;
}
