use anchor_lang::prelude::*;
use crate::state::{VaspRegistry, VaspProposal, ProposalStatus};
use crate::errors::SclError;

#[derive(Accounts)]
pub struct RejectVasp<'info> {
    #[account(
        mut,
        seeds = [b"vasp_proposal", proposal.vasp_pubkey.as_ref()],
        bump = proposal.bump,
        close = proposer,
    )]
    pub proposal: Account<'info, VaspProposal>,

    #[account(
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

pub fn handler(ctx: Context<RejectVasp>) -> Result<()> {
    let proposal = &ctx.accounts.proposal;

    require!(
        proposal.status == ProposalStatus::Pending,
        SclError::InvalidProposalStatus
    );

    Ok(())
}
