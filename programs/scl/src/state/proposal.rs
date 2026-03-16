use anchor_lang::prelude::*;

#[account]
pub struct VaspProposal {
    pub proposer: Pubkey,
    pub vasp_pubkey: Pubkey,
    pub name: String,
    pub jurisdiction: String,
    pub encryption_key: [u8; 32],
    pub proposed_at: i64,
    pub status: ProposalStatus,
    pub bump: u8,
}

impl VaspProposal {
    // 8 (discriminator) + 32 + 32 + (4+64) + (4+16) + 32 + 8 + 1 + 1 = 202
    pub const SIZE: usize = 8 + 32 + 32 + 68 + 20 + 32 + 8 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum ProposalStatus {
    Pending,
    Approved,
    Rejected,
}
