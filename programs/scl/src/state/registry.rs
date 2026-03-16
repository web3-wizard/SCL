use anchor_lang::prelude::*;

#[account]
pub struct VaspRegistry {
    pub owner: Pubkey,
    pub oracle_pubkeys: Vec<Pubkey>,
    pub travel_rule_threshold: u64,
    pub vasp_count: u32,
    pub vasps: Vec<VaspEntry>,
}

impl VaspRegistry {
    // 8 (discriminator) + 32 (owner) + 4 (oracle vec prefix) + 8 (threshold) + 4 (vasp_count) + 4 (vasp vec prefix) = 60
    pub const BASE_SIZE: usize = 8 + 32 + 4 + 8 + 4 + 4;
    pub const MAX_ORACLES: usize = 5;
    pub const MAX_VASPS: usize = 20;

    pub fn space() -> usize {
        Self::BASE_SIZE + Self::MAX_ORACLES * 32 + Self::MAX_VASPS * VaspEntry::SIZE
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct VaspEntry {
    pub vasp_pubkey: Pubkey,
    pub name: String,
    pub jurisdiction: String,
    pub encryption_key: [u8; 32],
}

impl VaspEntry {
    // 32 + (4+64) + (4+16) + 32 = 152
    pub const SIZE: usize = 32 + 68 + 20 + 32;
}
