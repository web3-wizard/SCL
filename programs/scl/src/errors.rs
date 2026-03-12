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
}
