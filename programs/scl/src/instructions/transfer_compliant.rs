use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    ed25519_program,
    sysvar::instructions::{
        self,
        load_current_index_checked,
        load_instruction_at_checked,
    },
    hash::hash,
};
use anchor_spl::token_2022::{self, Token2022, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount};
use crate::state::{VaspRegistry, RevocationList};
use crate::errors::SclError;
use crate::events::CompliantTransferEvent;
use crate::utils::MEMO_PROGRAM_ID;

#[derive(Accounts)]
pub struct TransferCompliant<'info> {
    #[account(
        seeds = [b"vasp_registry"],
        bump,
    )]
    pub registry: Account<'info, VaspRegistry>,

    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = sender,
        token::token_program = token_program,
    )]
    pub sender_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program,
    )]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    pub token_program: Program<'info, Token2022>,

    /// CHECK: Instructions sysvar used for Ed25519 and Memo introspection
    #[account(address = instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,

    #[account(seeds = [b"revocation_list"], bump)]
    pub revocation_list: Account<'info, RevocationList>,
}

pub fn handler(
    ctx: Context<TransferCompliant>,
    amount: u64,
    decimals: u8,
    attestation_wallet: Pubkey,
    attestation_expiry: i64,
    attestation_level: u8,
) -> Result<()> {
    let registry = &ctx.accounts.registry;
    let clock = Clock::get()?;

    // Step 1: Verify Ed25519 signature instruction exists in this transaction
    verify_ed25519_instruction(
        &ctx.accounts.instructions_sysvar,
        &registry.oracle_pubkeys,
        &attestation_wallet,
        attestation_expiry,
        attestation_level,
    )?;

    // Step 1.5: Check revocation list
    require!(
        !ctx.accounts.revocation_list.is_revoked(&attestation_wallet),
        SclError::AttestationRevoked
    );

    // Step 2: Validate attestation fields
    require!(
        attestation_wallet == ctx.accounts.sender.key(),
        SclError::AttestationWalletMismatch
    );
    require!(
        attestation_expiry > clock.unix_timestamp,
        SclError::AttestationExpired
    );

    // Step 3: Travel Rule check — require memo for transfers >= threshold
    if amount >= registry.travel_rule_threshold {
        verify_memo_instruction(&ctx.accounts.instructions_sysvar)?;
    }

    // Step 4: Execute Token-2022 transfer via CPI
    let cpi_accounts = TransferChecked {
        from: ctx.accounts.sender_token_account.to_account_info(),
        to: ctx.accounts.recipient_token_account.to_account_info(),
        authority: ctx.accounts.sender.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token_2022::transfer_checked(cpi_ctx, amount, decimals)?;

    // Emit event
    emit!(CompliantTransferEvent {
        sender: ctx.accounts.sender.key(),
        recipient: ctx.accounts.recipient_token_account.key(),
        amount,
        attestation_level,
        travel_rule_included: amount >= registry.travel_rule_threshold,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

/// Verify that a preceding Ed25519 program instruction exists in the transaction
/// that verifies the oracle's signature over SHA256(wallet || expiry || level).
fn verify_ed25519_instruction(
    instructions_sysvar: &AccountInfo,
    oracle_pubkeys: &[Pubkey],
    wallet: &Pubkey,
    expiry: i64,
    level: u8,
) -> Result<()> {
    // Reconstruct the expected message: SHA256(wallet || expiry || level)
    let mut message_data = Vec::with_capacity(41);
    message_data.extend_from_slice(&wallet.to_bytes());
    message_data.extend_from_slice(&expiry.to_le_bytes());
    message_data.push(level);
    let expected_message_hash = hash(&message_data).to_bytes();

    // Scan preceding instructions for Ed25519 verification
    let current_ix_index = load_current_index_checked(instructions_sysvar)
        .map_err(|_| SclError::MissingEd25519Instruction)?;

    for ix_index in 0..current_ix_index {
        let ix = load_instruction_at_checked(ix_index as usize, instructions_sysvar)
            .map_err(|_| SclError::MissingEd25519Instruction)?;

        if ix.program_id != ed25519_program::ID {
            continue;
        }

        // Parse Ed25519 instruction data
        // Layout: [num_signatures(1), padding(1), ...per-signature descriptors]
        if ix.data.len() < 2 {
            continue;
        }

        let num_signatures = ix.data[0] as usize;
        if num_signatures == 0 {
            continue;
        }

        // Each signature descriptor is 14 bytes starting at offset 2:
        //   signature_offset(2) + signature_ix_index(2) +
        //   public_key_offset(2) + public_key_ix_index(2) +
        //   message_data_offset(2) + message_data_size(2) +
        //   message_ix_index(2)
        for sig_idx in 0..num_signatures {
            let offset_base = 2 + sig_idx * 14;
            if ix.data.len() < offset_base + 14 {
                continue;
            }

            let pubkey_offset = u16::from_le_bytes(
                ix.data[offset_base + 4..offset_base + 6].try_into().unwrap()
            ) as usize;
            let msg_offset = u16::from_le_bytes(
                ix.data[offset_base + 8..offset_base + 10].try_into().unwrap()
            ) as usize;
            let msg_size = u16::from_le_bytes(
                ix.data[offset_base + 10..offset_base + 12].try_into().unwrap()
            ) as usize;

            // Extract and verify the public key matches any registered oracle
            if ix.data.len() < pubkey_offset + 32 {
                continue;
            }
            let ix_pubkey = &ix.data[pubkey_offset..pubkey_offset + 32];
            if !oracle_pubkeys.iter().any(|oracle| ix_pubkey == oracle.to_bytes()) {
                continue;
            }

            // Extract and verify the message matches the expected hash
            if ix.data.len() < msg_offset + msg_size {
                continue;
            }
            let ix_message = &ix.data[msg_offset..msg_offset + msg_size];

            if msg_size == 32 && ix_message == expected_message_hash {
                return Ok(());
            }
        }
    }

    Err(SclError::MissingEd25519Instruction.into())
}

/// Verify that a Memo program instruction exists (carrying the Travel Rule payload).
fn verify_memo_instruction(instructions_sysvar: &AccountInfo) -> Result<()> {
    let current_ix_index = load_current_index_checked(instructions_sysvar)
        .map_err(|_| SclError::MissingTravelRulePayload)?;

    for ix_index in 0..current_ix_index {
        let ix = load_instruction_at_checked(ix_index as usize, instructions_sysvar)
            .map_err(|_| SclError::MissingTravelRulePayload)?;

        if ix.program_id == MEMO_PROGRAM_ID && !ix.data.is_empty() {
            return Ok(());
        }
    }

    Err(SclError::MissingTravelRulePayload.into())
}
