use anchor_lang::prelude::*;
use crate::state::VaspRegistry;
use crate::errors::SclError;

#[derive(Accounts)]
pub struct AddOracle<'info> {
    #[account(
        mut,
        seeds = [b"vasp_registry"],
        bump,
        has_one = owner @ SclError::Unauthorized,
    )]
    pub registry: Account<'info, VaspRegistry>,

    pub owner: Signer<'info>,
}

pub fn handler(ctx: Context<AddOracle>, oracle_pubkey: Pubkey) -> Result<()> {
    let registry = &mut ctx.accounts.registry;

    require!(
        !registry.oracle_pubkeys.iter().any(|k| *k == oracle_pubkey),
        SclError::OracleAlreadyExists
    );
    require!(
        registry.oracle_pubkeys.len() < VaspRegistry::MAX_ORACLES,
        SclError::OracleListFull
    );

    registry.oracle_pubkeys.push(oracle_pubkey);
    Ok(())
}
