use anchor_lang::prelude::*;

#[account]
pub struct RevocationList {
    pub authority: Pubkey,
    pub revocation_count: u32,
    pub revoked_wallets: Vec<Pubkey>,
}

impl RevocationList {
    // 8 (discriminator) + 32 (authority) + 4 (count) + 4 (vec prefix) = 48
    pub const BASE_SIZE: usize = 8 + 32 + 4 + 4;
    pub const MAX_REVOCATIONS: usize = 100;

    pub fn space() -> usize {
        Self::BASE_SIZE + Self::MAX_REVOCATIONS * 32
    }

    pub fn is_revoked(&self, wallet: &Pubkey) -> bool {
        self.revoked_wallets.iter().any(|w| *w == *wallet)
    }
}
