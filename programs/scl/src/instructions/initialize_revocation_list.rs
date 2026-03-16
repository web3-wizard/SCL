use anchor_lang::prelude::*;
use crate::state::{VaspRegistry, RevocationList};
use crate::errors::SclError;

#[derive(Accounts)]
pub struct InitializeRevocationList<'info> {
    #[account(
        init,
        payer = owner,
        space = RevocationList::space(),
        seeds = [b"revocation_list"],
        bump,
    )]
    pub revocation_list: Account<'info, RevocationList>,

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

pub fn handler(ctx: Context<InitializeRevocationList>) -> Result<()> {
    let revocation_list = &mut ctx.accounts.revocation_list;
    revocation_list.authority = ctx.accounts.owner.key();
    revocation_list.revocation_count = 0;
    revocation_list.revoked_wallets = Vec::new();
    Ok(())
}
