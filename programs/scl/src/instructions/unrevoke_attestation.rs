use anchor_lang::prelude::*;
use crate::state::{VaspRegistry, RevocationList};
use crate::errors::SclError;
use crate::events::AttestationUnrevokedEvent;

#[derive(Accounts)]
pub struct UnrevokeAttestation<'info> {
    #[account(
        mut,
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

    pub owner: Signer<'info>,
}

pub fn handler(ctx: Context<UnrevokeAttestation>, wallet: Pubkey) -> Result<()> {
    let list = &mut ctx.accounts.revocation_list;

    let index = list.revoked_wallets.iter()
        .position(|w| *w == wallet)
        .ok_or(SclError::WalletNotRevoked)?;

    list.revoked_wallets.swap_remove(index);
    list.revocation_count -= 1;

    let clock = Clock::get()?;
    emit!(AttestationUnrevokedEvent {
        wallet,
        authority: ctx.accounts.owner.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
