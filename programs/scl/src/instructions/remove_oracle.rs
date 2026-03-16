use anchor_lang::prelude::*;
use crate::state::VaspRegistry;
use crate::errors::SclError;

#[derive(Accounts)]
pub struct RemoveOracle<'info> {
    #[account(
        mut,
        seeds = [b"vasp_registry"],
        bump,
        has_one = owner @ SclError::Unauthorized,
    )]
    pub registry: Account<'info, VaspRegistry>,

    pub owner: Signer<'info>,
}

pub fn handler(ctx: Context<RemoveOracle>, oracle_pubkey: Pubkey) -> Result<()> {
    let registry = &mut ctx.accounts.registry;

    require!(
        registry.oracle_pubkeys.len() > 1,
        SclError::CannotRemoveLastOracle
    );

    let index = registry.oracle_pubkeys.iter()
        .position(|k| *k == oracle_pubkey)
        .ok_or(SclError::OracleNotFound)?;

    registry.oracle_pubkeys.swap_remove(index);
    Ok(())
}
