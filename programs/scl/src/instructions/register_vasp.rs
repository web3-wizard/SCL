use anchor_lang::prelude::*;
use crate::state::{VaspRegistry, VaspEntry};
use crate::errors::SclError;
use crate::events::VaspRegisteredEvent;

#[derive(Accounts)]
pub struct RegisterVasp<'info> {
    #[account(
        mut,
        seeds = [b"vasp_registry"],
        bump,
        has_one = owner @ SclError::Unauthorized,
    )]
    pub registry: Account<'info, VaspRegistry>,

    pub owner: Signer<'info>,
}

pub fn handler(
    ctx: Context<RegisterVasp>,
    vasp_pubkey: Pubkey,
    name: String,
    jurisdiction: String,
    encryption_key: [u8; 32],
) -> Result<()> {
    let registry = &mut ctx.accounts.registry;

    if registry.vasps.iter().any(|v| v.vasp_pubkey == vasp_pubkey) {
        return Err(SclError::VaspAlreadyExists.into());
    }

    registry.vasps.push(VaspEntry {
        vasp_pubkey,
        name: name.clone(),
        jurisdiction: jurisdiction.clone(),
        encryption_key,
    });
    registry.vasp_count += 1;

    let clock = Clock::get()?;
    emit!(VaspRegisteredEvent {
        vasp_pubkey,
        name,
        jurisdiction,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
