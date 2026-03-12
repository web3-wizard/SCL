use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

declare_id!("SC1111111111111111111111111111111111111111111");

#[program]
pub mod scl {
    use super::*;

    pub fn initialize_registry(
        ctx: Context<instructions::InitializeRegistry>,
        oracle_pubkey: Pubkey,
        travel_rule_threshold: u64,
    ) -> Result<()> {
        instructions::initialize_registry::handler(ctx, oracle_pubkey, travel_rule_threshold)
    }

    pub fn register_vasp(
        ctx: Context<instructions::RegisterVasp>,
        vasp_pubkey: Pubkey,
        name: String,
        jurisdiction: String,
        encryption_key: [u8; 32],
    ) -> Result<()> {
        instructions::register_vasp::handler(ctx, vasp_pubkey, name, jurisdiction, encryption_key)
    }

    pub fn transfer_compliant(
        ctx: Context<instructions::TransferCompliant>,
        amount: u64,
        decimals: u8,
        attestation_wallet: Pubkey,
        attestation_expiry: i64,
        attestation_level: u8,
    ) -> Result<()> {
        instructions::transfer_compliant::handler(
            ctx, amount, decimals,
            attestation_wallet, attestation_expiry, attestation_level,
        )
    }
}
