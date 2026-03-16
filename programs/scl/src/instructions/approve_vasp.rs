use anchor_lang::prelude::*;
use crate::state::{VaspRegistry, VaspEntry, VaspProposal, ProposalStatus};
use crate::errors::SclError;

#[derive(Accounts)]
pub struct ApproveVasp<'info> {
    #[account(
        mut,
        seeds = [b"vasp_proposal", proposal.vasp_pubkey.as_ref()],
        bump = proposal.bump,
        close = proposer,
    )]
    pub proposal: Account<'info, VaspProposal>,

    #[account(
        mut,
        seeds = [b"vasp_registry"],
        bump,
        has_one = owner @ SclError::Unauthorized,
    )]
    pub registry: Account<'info, VaspRegistry>,

    pub owner: Signer<'info>,

    /// CHECK: Receives rent refund from closed proposal. Verified against proposal.proposer.
    #[account(mut, constraint = proposer.key() == proposal.proposer @ SclError::Unauthorized)]
    pub proposer: AccountInfo<'info>,
}

pub fn handler(ctx: Context<ApproveVasp>) -> Result<()> {
    let proposal = &ctx.accounts.proposal;
    let registry = &mut ctx.accounts.registry;

    require!(
        proposal.status == ProposalStatus::Pending,
        SclError::InvalidProposalStatus
    );

    require!(
        !registry.vasps.iter().any(|v| v.vasp_pubkey == proposal.vasp_pubkey),
        SclError::VaspAlreadyExists
    );

    require!(
        (registry.vasp_count as usize) < VaspRegistry::MAX_VASPS,
        SclError::RegistryFull
    );

    registry.vasps.push(VaspEntry {
        vasp_pubkey: proposal.vasp_pubkey,
        name: proposal.name.clone(),
        jurisdiction: proposal.jurisdiction.clone(),
        encryption_key: proposal.encryption_key,
    });
    registry.vasp_count += 1;

    Ok(())
}
