use anchor_lang::prelude::*;
use crate::state::VaspRegistry;

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(
        init,
        payer = owner,
        space = VaspRegistry::space(),
        seeds = [b"vasp_registry"],
        bump,
    )]
    pub registry: Account<'info, VaspRegistry>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeRegistry>,
    oracle_pubkey: Pubkey,
    travel_rule_threshold: u64,
) -> Result<()> {
    let registry = &mut ctx.accounts.registry;
    registry.owner = ctx.accounts.owner.key();
    registry.oracle_pubkey = oracle_pubkey;
    registry.travel_rule_threshold = travel_rule_threshold;
    registry.vasp_count = 0;
    registry.vasps = Vec::new();
    Ok(())
}
