use anchor_lang::prelude::*;
use crate::state::{VaspRegistry, ComplianceMerkleRoot};
use crate::errors::SclError;

#[derive(Accounts)]
pub struct UpdateMerkleRoot<'info> {
    #[account(
        mut,
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

    pub owner: Signer<'info>,
}

pub fn handler(
    ctx: Context<UpdateMerkleRoot>,
    new_root: [u8; 32],
    tree_size: u32,
) -> Result<()> {
    let merkle_root = &mut ctx.accounts.merkle_root;
    merkle_root.root = new_root;
    merkle_root.tree_size = tree_size;
    merkle_root.last_updated = Clock::get()?.unix_timestamp;
    Ok(())
}
