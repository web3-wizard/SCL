use anchor_lang::prelude::*;

#[event]
pub struct CompliantTransferEvent {
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub attestation_level: u8,
    pub travel_rule_included: bool,
    pub timestamp: i64,
}

#[event]
pub struct MerkleTransferEvent {
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub proof_size: u8,
    pub timestamp: i64,
}

#[event]
pub struct AttestationRevokedEvent {
    pub wallet: Pubkey,
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AttestationUnrevokedEvent {
    pub wallet: Pubkey,
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct VaspRegisteredEvent {
    pub vasp_pubkey: Pubkey,
    pub name: String,
    pub jurisdiction: String,
    pub timestamp: i64,
}

#[event]
pub struct VaspProposedEvent {
    pub vasp_pubkey: Pubkey,
    pub proposer: Pubkey,
    pub name: String,
    pub timestamp: i64,
}
