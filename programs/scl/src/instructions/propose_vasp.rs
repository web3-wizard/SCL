use anchor_lang::prelude::*;
use crate::state::{VaspRegistry, VaspProposal, ProposalStatus};
use crate::errors::SclError;
use crate::events::VaspProposedEvent;

#[derive(Accounts)]
#[instruction(vasp_pubkey: Pubkey)]
pub struct ProposeVasp<'info> {
    #[account(
        init,
        payer = proposer,
        space = VaspProposal::SIZE,
        seeds = [b"vasp_proposal", vasp_pubkey.as_ref()],
        bump,
    )]
    pub proposal: Account<'info, VaspProposal>,

    #[account(
        seeds = [b"vasp_registry"],
        bump,
    )]
    pub registry: Account<'info, VaspRegistry>,

    #[account(mut)]
    pub proposer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<ProposeVasp>,
    vasp_pubkey: Pubkey,
    name: String,
    jurisdiction: String,
    encryption_key: [u8; 32],
) -> Result<()> {
    let registry = &ctx.accounts.registry;

    require!(
        !registry.vasps.iter().any(|v| v.vasp_pubkey == vasp_pubkey),
        SclError::VaspAlreadyExists
    );
    require!(
        (registry.vasp_count as usize) < VaspRegistry::MAX_VASPS,
        SclError::RegistryFull
    );

    let clock = Clock::get()?;
    let proposal = &mut ctx.accounts.proposal;
    proposal.proposer = ctx.accounts.proposer.key();
    proposal.vasp_pubkey = vasp_pubkey;
    proposal.name = name;
    proposal.jurisdiction = jurisdiction;
    proposal.encryption_key = encryption_key;
    proposal.proposed_at = clock.unix_timestamp;
    proposal.status = ProposalStatus::Pending;
    proposal.bump = ctx.bumps.proposal;

    emit!(VaspProposedEvent {
        vasp_pubkey,
        proposer: ctx.accounts.proposer.key(),
        name: proposal.name.clone(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
