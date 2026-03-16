use anchor_lang::prelude::*;
use crate::state::{VaspRegistry, RevocationList};
use crate::errors::SclError;
use crate::events::AttestationRevokedEvent;

#[derive(Accounts)]
pub struct RevokeAttestation<'info> {
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

pub fn handler(ctx: Context<RevokeAttestation>, wallet: Pubkey) -> Result<()> {
    let list = &mut ctx.accounts.revocation_list;

    require!(
        !list.is_revoked(&wallet),
        SclError::WalletAlreadyRevoked
    );
    require!(
        list.revoked_wallets.len() < RevocationList::MAX_REVOCATIONS,
        SclError::RevocationListFull
    );

    list.revoked_wallets.push(wallet);
    list.revocation_count += 1;

    let clock = Clock::get()?;
    emit!(AttestationRevokedEvent {
        wallet,
        authority: ctx.accounts.owner.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
