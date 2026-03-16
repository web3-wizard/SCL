import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export interface TestFixtures {
  provider: anchor.AnchorProvider;
  oracleKeypair: Keypair;
  sender: Keypair;
  receiver: Keypair;
  mint: PublicKey;
  senderAta: PublicKey;
  receiverAta: PublicKey;
  registryPda: PublicKey;
  registryBump: number;
  revocationListPda: PublicKey;
  revocationListBump: number;
  merkleRootPda: PublicKey;
  merkleRootBump: number;
}

export async function setupTestFixtures(
  program: anchor.Program
): Promise<TestFixtures> {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const oracleKeypair = Keypair.generate();
  const sender = Keypair.generate();
  const receiver = Keypair.generate();

  // Airdrop SOL to sender and payer
  const airdropSender = await provider.connection.requestAirdrop(
    sender.publicKey,
    10 * anchor.web3.LAMPORTS_PER_SOL
  );
  await provider.connection.confirmTransaction(airdropSender);

  const airdropPayer = await provider.connection.requestAirdrop(
    provider.wallet.publicKey,
    10 * anchor.web3.LAMPORTS_PER_SOL
  );
  await provider.connection.confirmTransaction(airdropPayer);

  // Create Token-2022 mint (rUSDC with 6 decimals)
  const mintAuthority = (provider.wallet as anchor.Wallet).payer;
  const mint = await createMint(
    provider.connection,
    mintAuthority,
    mintAuthority.publicKey,
    null,
    6,
    Keypair.generate(),
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  // Create associated token accounts
  const senderAtaAccount = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    mintAuthority,
    mint,
    sender.publicKey,
    false,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const receiverAtaAccount = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    mintAuthority,
    mint,
    receiver.publicKey,
    false,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Mint 10,000 rUSDC to sender
  await mintTo(
    provider.connection,
    mintAuthority,
    mint,
    senderAtaAccount.address,
    mintAuthority,
    10_000_000_000,
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  // Find registry PDA
  const [registryPda, registryBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("vasp_registry")],
    program.programId
  );

  // Find revocation list PDA
  const [revocationListPda, revocationListBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("revocation_list")],
    program.programId
  );

  // Find merkle root PDA
  const [merkleRootPda, merkleRootBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("compliance_merkle_root")],
    program.programId
  );

  return {
    provider,
    oracleKeypair,
    sender,
    receiver,
    mint,
    senderAta: senderAtaAccount.address,
    receiverAta: receiverAtaAccount.address,
    registryPda,
    registryBump,
    revocationListPda,
    revocationListBump,
    merkleRootPda,
    merkleRootBump,
  };
}
