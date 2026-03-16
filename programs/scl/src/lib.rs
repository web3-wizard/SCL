use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
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

    pub fn initialize_revocation_list(
        ctx: Context<instructions::InitializeRevocationList>,
    ) -> Result<()> {
        instructions::initialize_revocation_list::handler(ctx)
    }

    pub fn revoke_attestation(
        ctx: Context<instructions::RevokeAttestation>,
        wallet: Pubkey,
    ) -> Result<()> {
        instructions::revoke_attestation::handler(ctx, wallet)
    }

    pub fn unrevoke_attestation(
        ctx: Context<instructions::UnrevokeAttestation>,
        wallet: Pubkey,
    ) -> Result<()> {
        instructions::unrevoke_attestation::handler(ctx, wallet)
    }

    pub fn add_oracle(
        ctx: Context<instructions::AddOracle>,
        oracle_pubkey: Pubkey,
    ) -> Result<()> {
        instructions::add_oracle::handler(ctx, oracle_pubkey)
    }

    pub fn remove_oracle(
        ctx: Context<instructions::RemoveOracle>,
        oracle_pubkey: Pubkey,
    ) -> Result<()> {
        instructions::remove_oracle::handler(ctx, oracle_pubkey)
    }

    pub fn propose_vasp(
        ctx: Context<instructions::ProposeVasp>,
        vasp_pubkey: Pubkey,
        name: String,
        jurisdiction: String,
        encryption_key: [u8; 32],
    ) -> Result<()> {
        instructions::propose_vasp::handler(ctx, vasp_pubkey, name, jurisdiction, encryption_key)
    }

    pub fn approve_vasp(
        ctx: Context<instructions::ApproveVasp>,
    ) -> Result<()> {
        instructions::approve_vasp::handler(ctx)
    }

    pub fn reject_vasp(
        ctx: Context<instructions::RejectVasp>,
    ) -> Result<()> {
        instructions::reject_vasp::handler(ctx)
    }

    pub fn initialize_merkle_root(
        ctx: Context<instructions::InitializeMerkleRoot>,
    ) -> Result<()> {
        instructions::initialize_merkle_root::handler(ctx)
    }

    pub fn update_merkle_root(
        ctx: Context<instructions::UpdateMerkleRoot>,
        new_root: [u8; 32],
        tree_size: u32,
    ) -> Result<()> {
        instructions::update_merkle_root::handler(ctx, new_root, tree_size)
    }

    pub fn transfer_compliant_merkle(
        ctx: Context<instructions::TransferCompliantMerkle>,
        amount: u64,
        decimals: u8,
        merkle_proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        instructions::transfer_compliant_merkle::handler(ctx, amount, decimals, merkle_proof)
    }
}
