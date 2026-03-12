import {
  Connection,
  Ed25519Program,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha256";
import { Buffer } from "buffer";
import { SCL_PROGRAM_ID, MEMO_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "./constants";

export function buildEd25519VerifyInstruction(
  oraclePublicKey: Uint8Array,
  signature: Uint8Array,
  wallet: PublicKey,
  expiry: number,
  level: number
): TransactionInstruction {
  const messagePreimage = Buffer.alloc(41);
  messagePreimage.set(wallet.toBytes(), 0);
  messagePreimage.writeBigInt64LE(BigInt(expiry), 32);
  messagePreimage.writeUInt8(level, 40);
  const messageHash = sha256(messagePreimage);

  return Ed25519Program.createInstructionWithPublicKey({
    publicKey: oraclePublicKey,
    message: Buffer.from(messageHash),
    signature: Buffer.from(signature),
  });
}

export function buildMemoInstruction(
  encryptedPayload: string,
  signer: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(encryptedPayload, "utf-8"),
  });
}

export function getRegistryPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vasp_registry")],
    SCL_PROGRAM_ID
  );
  return pda;
}

export async function buildCompliantTransferTransaction(
  connection: Connection,
  program: any,
  sender: PublicKey,
  senderTokenAccount: PublicKey,
  recipientTokenAccount: PublicKey,
  mint: PublicKey,
  amount: bigint,
  decimals: number,
  oraclePublicKey: Uint8Array,
  attestationSignature: Uint8Array,
  attestationExpiry: number,
  attestationLevel: number,
  encryptedTravelRule: string | null
): Promise<VersionedTransaction> {
  const instructions: TransactionInstruction[] = [];

  // 1. Ed25519 signature verification instruction
  instructions.push(
    buildEd25519VerifyInstruction(
      oraclePublicKey,
      attestationSignature,
      sender,
      attestationExpiry,
      attestationLevel
    )
  );

  // 2. Memo with Travel Rule payload (if required)
  if (encryptedTravelRule) {
    instructions.push(buildMemoInstruction(encryptedTravelRule, sender));
  }

  // 3. transfer_compliant instruction via Anchor
  const registryPda = getRegistryPda();

  const transferIx = await program.methods
    .transferCompliant(
      { toNumber: () => Number(amount) } as any,
      decimals,
      sender,
      { toNumber: () => attestationExpiry } as any,
      attestationLevel
    )
    .accounts({
      registry: registryPda,
      sender: sender,
      senderTokenAccount,
      recipientTokenAccount,
      mint,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
    })
    .instruction();

  instructions.push(transferIx);

  // Build versioned transaction
  const { blockhash } = await connection.getLatestBlockhash();
  const messageV0 = new TransactionMessage({
    payerKey: sender,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  return new VersionedTransaction(messageV0);
}
