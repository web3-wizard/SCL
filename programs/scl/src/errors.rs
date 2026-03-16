use anchor_lang::prelude::*;

#[error_code]
pub enum SclError {
    #[msg("Attestation wallet does not match the transfer sender")]
    AttestationWalletMismatch,

    #[msg("Attestation has expired")]
    AttestationExpired,

    #[msg("Travel Rule payload is required for transfers at or above the threshold")]
    MissingTravelRulePayload,

    #[msg("VASP with this public key already exists in the registry")]
    VaspAlreadyExists,

    #[msg("Only the registry owner can perform this action")]
    Unauthorized,

    #[msg("Ed25519 signature verification instruction not found")]
    MissingEd25519Instruction,

    #[msg("Ed25519 signature verification failed")]
    InvalidSignatureVerification,

    #[msg("Invalid attestation message format")]
    InvalidAttestationMessage,

    #[msg("Wallet attestation has been revoked")]
    AttestationRevoked,

    #[msg("Wallet is not in the revocation list")]
    WalletNotRevoked,

    #[msg("Revocation list has reached maximum capacity")]
    RevocationListFull,

    #[msg("Wallet is already in the revocation list")]
    WalletAlreadyRevoked,

    #[msg("Oracle is already registered in the registry")]
    OracleAlreadyExists,

    #[msg("Oracle not found in the registry")]
    OracleNotFound,

    #[msg("Maximum number of oracles reached")]
    OracleListFull,

    #[msg("Cannot remove the last oracle from the registry")]
    CannotRemoveLastOracle,

    #[msg("Proposal is not in pending status")]
    InvalidProposalStatus,

    #[msg("VASP registry has reached maximum capacity")]
    RegistryFull,

    #[msg("Invalid Merkle proof - wallet is not in the compliant set")]
    InvalidMerkleProof,
}
