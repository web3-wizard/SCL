use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    keccak,
    sysvar::instructions::{
        self,
        load_current_index_checked,
        load_instruction_at_checked,
    },
};
use anchor_spl::token_2022::{self, Token2022, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount};
use crate::state::{VaspRegistry, RevocationList, ComplianceMerkleRoot};
use crate::errors::SclError;
use crate::events::MerkleTransferEvent;
use crate::utils::MEMO_PROGRAM_ID;

#[derive(Accounts)]
pub struct TransferCompliantMerkle<'info> {
    #[account(
        seeds = [b"vasp_registry"],
        bump,
    )]
    pub registry: Account<'info, VaspRegistry>,

    #[account(
        seeds = [b"compliance_merkle_root"],
        bump,
    )]
    pub merkle_root: Account<'info, ComplianceMerkleRoot>,

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

    /// CHECK: Instructions sysvar used for Memo introspection
    #[account(address = instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,

    #[account(seeds = [b"revocation_list"], bump)]
    pub revocation_list: Account<'info, RevocationList>,
}

pub fn handler(
    ctx: Context<TransferCompliantMerkle>,
    amount: u64,
    decimals: u8,
    merkle_proof: Vec<[u8; 32]>,
) -> Result<()> {
    let registry = &ctx.accounts.registry;
    let merkle_root_account = &ctx.accounts.merkle_root;
    let clock = Clock::get()?;

    // Step 1: Verify Merkle proof for sender
    let leaf = keccak::hash(&ctx.accounts.sender.key().to_bytes()).to_bytes();
    let computed_root = merkle_proof.iter().fold(leaf, |current, proof_element| {
        if current <= *proof_element {
            keccak::hashv(&[&current, proof_element]).to_bytes()
        } else {
            keccak::hashv(&[proof_element, &current]).to_bytes()
        }
    });

    require!(
        computed_root == merkle_root_account.root,
        SclError::InvalidMerkleProof
    );

    // Step 2: Check revocation list
    require!(
        !ctx.accounts.revocation_list.is_revoked(&ctx.accounts.sender.key()),
        SclError::AttestationRevoked
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
    emit!(MerkleTransferEvent {
        sender: ctx.accounts.sender.key(),
        recipient: ctx.accounts.recipient_token_account.key(),
        amount,
        proof_size: merkle_proof.len() as u8,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

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
