use anchor_lang::prelude::*;
use crate::state::{VaspRegistry, ComplianceMerkleRoot};
use crate::errors::SclError;

#[derive(Accounts)]
pub struct InitializeMerkleRoot<'info> {
    #[account(
        init,
        payer = owner,
        space = ComplianceMerkleRoot::SIZE,
        seeds = [b"compliance_merkle_root"],
        bump,
    )]
    pub merkle_root: Account<'info, ComplianceMerkleRoot>,

    #[account(
        seeds = [b"vasp_registry"],
        bump,
        has_one = owner @ SclError::Unauthorized,
    )]
    pub registry: Account<'info, VaspRegistry>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeMerkleRoot>) -> Result<()> {
    let merkle_root = &mut ctx.accounts.merkle_root;
    merkle_root.authority = ctx.accounts.owner.key();
    merkle_root.root = [0u8; 32];
    merkle_root.tree_size = 0;
    merkle_root.last_updated = Clock::get()?.unix_timestamp;
    Ok(())
}
