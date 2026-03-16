use anchor_lang::prelude::*;

#[account]
pub struct ComplianceMerkleRoot {
    pub authority: Pubkey,
    pub root: [u8; 32],
    pub tree_size: u32,
    pub last_updated: i64,
}

impl ComplianceMerkleRoot {
    // 8 (discriminator) + 32 + 32 + 4 + 8 = 84
    pub const SIZE: usize = 8 + 32 + 32 + 4 + 8;
}
