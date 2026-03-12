import { Connection, Keypair } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/**
 * Create rUSDC Token-2022 mint and fund demo wallets.
 * Run: npx ts-node scripts/setup-demo-tokens.ts
 */
async function setup() {
  const connection = new Connection("http://localhost:8899", "confirmed");

  // Load payer from Solana CLI default keypair
  const keypairPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const payer = Keypair.fromSecretKey(new Uint8Array(secretKey));

  console.log("Payer:", payer.publicKey.toBase58());

  // Create Token-2022 mint (rUSDC, 6 decimals)
  const mintAuthority = payer;
  const mint = await createMint(
    connection,
    payer,
    mintAuthority.publicKey,
    null,
    6,
    Keypair.generate(),
    undefined,
    TOKEN_2022_PROGRAM_ID
  );
  console.log("rUSDC Mint:", mint.toBase58());

  // Create sender token account
  const senderAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey,
    false,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  console.log("Sender ATA:", senderAta.address.toBase58());

  // Mint 10,000 rUSDC to sender
  await mintTo(
    connection,
    payer,
    mint,
    senderAta.address,
    mintAuthority,
    10_000_000_000, // 10,000 * 10^6
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  console.log("Minted 10,000 rUSDC to sender");
  console.log("\n=== Demo Token Setup Complete ===");
  console.log(`Mint:       ${mint.toBase58()}`);
  console.log(`Sender ATA: ${senderAta.address.toBase58()}`);
}

setup().catch(console.error);
