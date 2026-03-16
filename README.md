# SCL — Solana Compliance Layer

**Regulatory compliance middleware for Solana token transfers.**

SCL is an on-chain program (smart contract) built with Anchor that enforces KYC/AML compliance, Travel Rule data exchange, and VASP registry management for Token-2022 transfers on Solana. It is accompanied by an off-chain compliance oracle and a React frontend dashboard.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Project Structure](#project-structure)
- [On-Chain Program](#on-chain-program)
  - [Account Schemas](#account-schemas)
  - [Instructions](#instructions)
  - [Events](#events)
  - [Error Codes](#error-codes)
- [Compliance Oracle](#compliance-oracle)
  - [API Endpoints](#api-endpoints)
  - [Signing Modes](#signing-modes)
  - [Merkle Tree Service](#merkle-tree-service)
- [Frontend Application](#frontend-application)
- [Cryptographic Design](#cryptographic-design)
  - [Ed25519 Attestation Flow](#ed25519-attestation-flow)
  - [Merkle Proof Verification](#merkle-proof-verification)
  - [Travel Rule Encryption](#travel-rule-encryption)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Build & Deploy](#build--deploy)
  - [Run Tests](#run-tests)
  - [Run Demo](#run-demo)
- [Configuration](#configuration)
- [Testing](#testing)
- [Security Considerations](#security-considerations)
- [License](#license)

---

## Overview

Financial institutions operating on Solana (VASPs — Virtual Asset Service Providers) face regulatory requirements including:

- **KYC/AML verification** — ensuring wallet holders are identity-verified before transfers
- **Travel Rule compliance** (FATF Recommendation 16) — exchanging originator/beneficiary data for transfers above a jurisdiction-defined threshold
- **VASP registration** — maintaining an on-chain registry of compliant institutions
- **Attestation revocation** — ability to revoke a wallet's compliance status in real time

SCL enforces all of these at the protocol level. A transfer cannot succeed unless the sender holds a valid, non-revoked compliance attestation signed by a trusted oracle, and Travel Rule data is attached when required.

### How It Works

```
  Sender Wallet                    Compliance Oracle                 Solana Program (SCL)
  ─────────────                    ─────────────────                 ────────────────────
       │                                  │                                  │
       │  1. POST /attest {wallet}        │                                  │
       │ ────────────────────────────────> │                                  │
       │                                  │                                  │
       │  2. {signature, expiry, level}   │                                  │
       │ <──────────────────────────────── │                                  │
       │                                  │                                  │
       │  3. Build transaction:                                              │
       │     [Ed25519Verify, Memo?, TransferCompliant]                       │
       │ ──────────────────────────────────────────────────────────────────> │
       │                                  │                                  │
       │                                  │     4. Verify Ed25519 precompile │
       │                                  │        Check expiry              │
       │                                  │        Check revocation list     │
       │                                  │        Check travel rule memo    │
       │                                  │        Execute Token-2022 CPI    │
       │                                  │        Emit event                │
       │                                  │                                  │
       │  5. Transaction confirmed        │                                  │
       │ <────────────────────────────────────────────────────────────────── │
```

---

## Architecture

SCL is a monorepo with three components:

| Component | Technology | Port | Description |
|-----------|-----------|------|-------------|
| **On-chain Program** | Rust / Anchor 0.30.1 | — | Solana BPF program enforcing compliance rules |
| **Compliance Oracle** | Node.js / Express | 3001 | Off-chain attestation signer + Merkle tree + stats |
| **Frontend App** | React 18 / Vite 5 | 5173 | Wallet dashboard with Send, Receive, Analytics tabs |

```
┌─────────────────────────────────────────────────────────┐
│                     Solana Blockchain                     │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ VaspRegistry │  │RevocationList│  │ComplianceMerkle│  │
│  │     PDA      │  │     PDA      │  │   Root PDA     │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │ VaspProposal │  │  Token-2022  │                     │
│  │     PDA      │  │   Accounts   │                     │
│  └──────────────┘  └──────────────┘                     │
│                                                          │
│        SCL Program  •  Ed25519 Precompile  •  Memo       │
└─────────────────────────────────────────────────────────┘
         ▲                                      ▲
         │                                      │
    Transactions                           Transactions
         │                                      │
┌────────┴────────┐                  ┌──────────┴─────────┐
│  React Frontend │  ◄── REST ──►   │  Compliance Oracle  │
│  (Phantom)      │                  │  (Express)          │
└─────────────────┘                  └────────────────────┘
```

---

## Features

### MUST HAVE (Core Compliance)

| Feature | Description |
|---------|-------------|
| Ed25519 attestation verification | On-chain verification via Solana's Ed25519 precompile introspection |
| Token-2022 CPI transfers | All transfers use `transfer_checked` via `anchor_spl::token_2022` |
| Travel Rule enforcement | Memo program introspection enforces encrypted payload for transfers ≥ threshold |
| VASP registry | On-chain registry with name, jurisdiction, and X25519 encryption keys |
| Configurable threshold | Owner-defined travel rule threshold (default: 1000 rUSDC) |
| Attestation expiry | On-chain timestamp validation prevents use of stale attestations |
| Oracle-signed attestations | SHA-256 + Ed25519 signature scheme with 41-byte structured preimage |
| X25519 encryption | Travel Rule payloads encrypted with XSalsa20-Poly1305 via TweetNaCl |

### SHOULD HAVE (Enhanced Security)

| Feature | Description |
|---------|-------------|
| Attestation revocation | `RevocationList` PDA with revoke/unrevoke instructions, checked on every transfer |
| Multiple compliance oracles | `oracle_pubkeys` Vec (max 5) with add/remove management, any-of verification |
| Governance VASP registration | `VaspProposal` PDA — propose/approve/reject workflow with rent refund on rejection |

### COULD HAVE (Advanced)

| Feature | Description |
|---------|-------------|
| ZK simulation (Merkle tree) | Keccak256 sorted-pair Merkle proof verification for privacy-preserving compliance |
| Fireblocks API integration | Raw Signing API client with JWT RS256 authentication for institutional-grade key custody |
| Analytics dashboard | 6 Anchor events, oracle stats tracking, React dashboard with real-time metrics |

---

## Project Structure

```
SCL/
├── programs/scl/                  # On-chain Anchor program
│   └── src/
│       ├── lib.rs                 #   Program entrypoint — 14 instruction handlers
│       ├── errors.rs              #   19 error codes (6000–6018)
│       ├── events.rs              #   6 Anchor event structs
│       ├── utils.rs               #   Constants (Memo Program ID)
│       ├── state/                 #   Account schemas
│       │   ├── registry.rs        #     VaspRegistry + VaspEntry
│       │   ├── revocation_list.rs #     RevocationList
│       │   ├── proposal.rs        #     VaspProposal + ProposalStatus
│       │   └── merkle_root.rs     #     ComplianceMerkleRoot
│       └── instructions/          #   Instruction handlers
│           ├── initialize_registry.rs
│           ├── register_vasp.rs
│           ├── transfer_compliant.rs
│           ├── transfer_compliant_merkle.rs
│           ├── initialize_revocation_list.rs
│           ├── revoke_attestation.rs
│           ├── unrevoke_attestation.rs
│           ├── add_oracle.rs
│           ├── remove_oracle.rs
│           ├── propose_vasp.rs
│           ├── approve_vasp.rs
│           ├── reject_vasp.rs
│           ├── initialize_merkle_root.rs
│           └── update_merkle_root.rs
│
├── oracle/                        # Off-chain compliance oracle
│   └── src/
│       ├── index.ts               #   Express server (port 3001)
│       ├── keypair.ts             #   Demo Ed25519 oracle keypair
│       ├── types.ts               #   TypeScript interfaces
│       ├── routes/
│       │   ├── attest.ts          #     POST /attest
│       │   ├── merkle.ts          #     Merkle tree CRUD routes
│       │   └── stats.ts           #     GET /stats
│       └── services/
│           ├── signer.ts          #     Attestation signing (async, Fireblocks-aware)
│           ├── merkle.ts          #     Keccak256 Merkle tree implementation
│           ├── stats.ts           #     In-memory statistics tracker
│           ├── fireblocks.ts      #     Fireblocks Raw Signing API client
│           └── fireblocks-mock.ts #     Mock client for local testing
│
├── app/                           # React frontend
│   └── src/
│       ├── App.tsx                #   Root component (Send | Receive | Analytics tabs)
│       ├── main.tsx               #   Vite entrypoint
│       ├── components/
│       │   ├── TransferForm.tsx    #     Compliant transfer form
│       │   ├── ReceiverDashboard.tsx #   Travel Rule decryption
│       │   ├── AnalyticsDashboard.tsx #  Real-time metrics dashboard
│       │   ├── WalletConnect.tsx   #     Phantom wallet button
│       │   ├── AttestationBadge.tsx #    Visual KYC status indicator
│       │   └── StatusDisplay.tsx   #     Transaction status display
│       ├── hooks/
│       │   ├── useAttestation.ts   #     Oracle attestation fetcher
│       │   ├── useCompliantTransfer.ts # Transfer transaction builder
│       │   ├── useTravelRule.ts    #     X25519 encrypt/decrypt
│       │   └── useAnalytics.ts     #     Aggregated analytics data
│       ├── utils/
│       │   ├── transaction.ts      #     Ed25519 IX, Memo IX, PDA derivation, TX builders
│       │   ├── merkle.ts           #     Oracle Merkle proof fetcher
│       │   ├── attestation.ts      #     Attestation data parsing
│       │   ├── encryption.ts       #     X25519 + XSalsa20-Poly1305 encryption
│       │   └── constants.ts        #     Program IDs, oracle URL, threshold
│       └── idl/
│           └── scl.json            #     Anchor IDL (14 IX, 4 accounts, 6 events, 19 errors)
│
├── tests/
│   ├── scl.spec.ts                # 13 test scenarios
│   └── helpers/
│       ├── setup.ts               #   Test fixtures (mint, ATAs, PDAs)
│       ├── attestation.ts         #   Test attestation builder
│       └── merkle.ts              #   Test Merkle tree helper
│
├── scripts/
│   ├── demo.ts                    # 10-scenario end-to-end demo
│   ├── generate-vasp-keys.ts      # X25519 keypair generator
│   └── setup-demo-tokens.ts       # rUSDC Token-2022 mint setup
│
├── Anchor.toml                    # Anchor configuration
├── Cargo.toml                     # Rust workspace
├── package.json                   # npm workspace root
└── tsconfig.json                  # TypeScript config (tests)
```

---

## On-Chain Program

**Framework:** Anchor 0.30.1 | **Solana SDK:** ~1.18 | **Program ID:** `SC1111111111111111111111111111111111111111111`

### Account Schemas

#### VaspRegistry (PDA)

**Seed:** `"vasp_registry"` | **Size:** 3,260 bytes

| Field | Type | Description |
|-------|------|-------------|
| `owner` | `Pubkey` | Registry admin (can register VASPs, manage oracles) |
| `oracle_pubkeys` | `Vec<Pubkey>` | Trusted oracle public keys (max 5) |
| `travel_rule_threshold` | `u64` | Minimum amount requiring Travel Rule data |
| `vasp_count` | `u32` | Number of registered VASPs |
| `vasps` | `Vec<VaspEntry>` | Registered VASP list (max 20) |

**VaspEntry** (nested struct, 152 bytes):

| Field | Type | Description |
|-------|------|-------------|
| `vasp_pubkey` | `Pubkey` | VASP's Solana public key |
| `name` | `String` | Institution name (max 64 chars) |
| `jurisdiction` | `String` | ISO country code (max 16 chars) |
| `encryption_key` | `[u8; 32]` | X25519 public key for Travel Rule encryption |

#### RevocationList (PDA)

**Seed:** `"revocation_list"` | **Size:** 3,248 bytes

| Field | Type | Description |
|-------|------|-------------|
| `authority` | `Pubkey` | Registry owner |
| `revocation_count` | `u32` | Number of revoked wallets |
| `revoked_wallets` | `Vec<Pubkey>` | Revoked wallet addresses (max 100) |

#### VaspProposal (PDA)

**Seed:** `["vasp_proposal", vasp_pubkey]` | **Size:** 202 bytes

| Field | Type | Description |
|-------|------|-------------|
| `proposer` | `Pubkey` | Account that submitted the proposal |
| `vasp_pubkey` | `Pubkey` | Proposed VASP's public key |
| `name` | `String` | Institution name |
| `jurisdiction` | `String` | ISO country code |
| `encryption_key` | `[u8; 32]` | X25519 public key |
| `proposed_at` | `i64` | Unix timestamp of proposal |
| `status` | `ProposalStatus` | `Pending` / `Approved` / `Rejected` |
| `bump` | `u8` | PDA bump seed |

#### ComplianceMerkleRoot (PDA)

**Seed:** `"compliance_merkle_root"` | **Size:** 84 bytes

| Field | Type | Description |
|-------|------|-------------|
| `authority` | `Pubkey` | Registry owner |
| `root` | `[u8; 32]` | Current Merkle root hash |
| `tree_size` | `u32` | Number of wallets in the tree |
| `last_updated` | `i64` | Unix timestamp of last root update |

### Instructions

#### Registry & VASP Management

| Instruction | Signer | Description |
|------------|--------|-------------|
| `initialize_registry` | Owner | Creates the `VaspRegistry` PDA with an initial oracle and threshold |
| `register_vasp` | Owner | Directly registers a VASP (emits `VaspRegisteredEvent`) |
| `add_oracle` | Owner | Adds an oracle pubkey to the registry (max 5) |
| `remove_oracle` | Owner | Removes an oracle (cannot remove the last one) |

#### Compliance Transfers

| Instruction | Signer | Description |
|------------|--------|-------------|
| `transfer_compliant` | Sender | Executes a Token-2022 transfer with Ed25519 attestation, revocation check, and optional Travel Rule memo (emits `CompliantTransferEvent`) |
| `transfer_compliant_merkle` | Sender | Executes a Token-2022 transfer verified by Merkle proof instead of Ed25519 attestation (emits `MerkleTransferEvent`) |

#### Revocation

| Instruction | Signer | Description |
|------------|--------|-------------|
| `initialize_revocation_list` | Owner | Creates the `RevocationList` PDA |
| `revoke_attestation` | Owner | Adds a wallet to the revocation list (emits `AttestationRevokedEvent`) |
| `unrevoke_attestation` | Owner | Removes a wallet from the revocation list (emits `AttestationUnrevokedEvent`) |

#### Governance Proposals

| Instruction | Signer | Description |
|------------|--------|-------------|
| `propose_vasp` | Any user | Creates a `VaspProposal` PDA (emits `VaspProposedEvent`) |
| `approve_vasp` | Owner | Approves proposal → registers VASP, closes proposal PDA |
| `reject_vasp` | Owner | Rejects proposal → closes PDA, refunds rent to proposer |

#### Merkle Tree

| Instruction | Signer | Description |
|------------|--------|-------------|
| `initialize_merkle_root` | Owner | Creates the `ComplianceMerkleRoot` PDA |
| `update_merkle_root` | Owner | Sets a new root hash and tree size |

### Events

| Event | Emitted By | Fields |
|-------|-----------|--------|
| `CompliantTransferEvent` | `transfer_compliant` | sender, recipient, amount, attestation_level, travel_rule_included, timestamp |
| `MerkleTransferEvent` | `transfer_compliant_merkle` | sender, recipient, amount, proof_size, timestamp |
| `AttestationRevokedEvent` | `revoke_attestation` | wallet, authority, timestamp |
| `AttestationUnrevokedEvent` | `unrevoke_attestation` | wallet, authority, timestamp |
| `VaspRegisteredEvent` | `register_vasp` + `approve_vasp` | vasp_pubkey, name, jurisdiction, timestamp |
| `VaspProposedEvent` | `propose_vasp` | vasp_pubkey, proposer, name, timestamp |

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| 6000 | `AttestationWalletMismatch` | Attestation wallet doesn't match the sender |
| 6001 | `AttestationExpired` | Attestation timestamp has passed |
| 6002 | `MissingTravelRulePayload` | Transfer ≥ threshold without memo |
| 6003 | `VaspAlreadyExists` | Duplicate VASP registration |
| 6004 | `Unauthorized` | Non-owner attempted owner-only action |
| 6005 | `MissingEd25519Instruction` | No Ed25519 precompile in transaction |
| 6006 | `InvalidSignatureVerification` | Ed25519 signature doesn't match |
| 6007 | `InvalidAttestationMessage` | Malformed attestation preimage |
| 6008 | `AttestationRevoked` | Wallet is on the revocation list |
| 6009 | `WalletNotRevoked` | Wallet not found in revocation list |
| 6010 | `RevocationListFull` | Max 100 revocations reached |
| 6011 | `WalletAlreadyRevoked` | Wallet already revoked |
| 6012 | `OracleAlreadyExists` | Duplicate oracle pubkey |
| 6013 | `OracleNotFound` | Oracle not in registry |
| 6014 | `OracleListFull` | Max 5 oracles reached |
| 6015 | `CannotRemoveLastOracle` | Must keep at least one oracle |
| 6016 | `InvalidProposalStatus` | Proposal not in `Pending` state |
| 6017 | `RegistryFull` | Max 20 VASPs reached |
| 6018 | `InvalidMerkleProof` | Merkle proof doesn't compute to stored root |

---

## Compliance Oracle

**Runtime:** Node.js | **Framework:** Express 4 | **Port:** 3001

The oracle is a stateless compliance service that signs attestations and maintains an off-chain Merkle tree. It supports two signing backends:

- **Local** (default) — Ed25519 via TweetNaCl using a deterministic demo keypair
- **Fireblocks** — Raw Signing API with MPC EdDSA for institutional key custody

### API Endpoints

#### Attestation

```
POST /attest
Body: { "wallet": "<base58 pubkey>", "level": 1 }
Response: { "wallet": "...", "expiry": 1234567890, "level": 1, "signature": "<base64>" }
```

Issues a time-limited (1 hour) compliance attestation. The signature covers a 41-byte preimage: `wallet(32) || expiry(8 LE) || level(1)`, SHA-256 hashed then Ed25519 signed.

#### Merkle Tree

```
POST   /merkle/add              — Add a wallet to the compliance tree
POST   /merkle/remove           — Remove a wallet from the tree
GET    /merkle/root             — Get current root hash and tree size
GET    /merkle/proof/:wallet    — Get inclusion proof for a wallet
```

#### Stats & Health

```
GET /stats       — Attestation counts, Merkle stats, uptime
GET /health      — Oracle status, public key, signing mode
```

### Signing Modes

| Mode | Trigger | Use Case |
|------|---------|----------|
| **Local** | Default (no env vars) | Development, testing, demos |
| **Fireblocks** | Set `FIREBLOCKS_API_KEY`, `FIREBLOCKS_API_SECRET_PATH`, `FIREBLOCKS_VAULT_ID` | Production with MPC key custody |

### Merkle Tree Service

The oracle maintains an in-memory keccak256 Merkle tree with sorted-pair hashing:

```
hash(a, b) = keccak256(min(a,b) || max(a,b))
```

This convention matches the on-chain `transfer_compliant_merkle` instruction, enabling privacy-preserving compliance verification — wallets can prove membership in a compliant set without revealing the full list.

---

## Frontend Application

**Framework:** React 18 | **Bundler:** Vite 5 | **Wallet:** Phantom (Solana Wallet Adapter)

### Tabs

| Tab | Component | Purpose |
|-----|-----------|---------|
| **Send** | `TransferForm` | Build and send compliant Token-2022 transfers with auto-attestation |
| **Receive** | `ReceiverDashboard` | Decrypt Travel Rule payloads from incoming transfers |
| **Analytics** | `AnalyticsDashboard` | Real-time compliance metrics from oracle + on-chain state |

### Key Hooks

| Hook | Purpose |
|------|---------|
| `useAttestation` | Fetches attestation from oracle, manages validity state |
| `useCompliantTransfer` | Builds the 3-instruction transaction (Ed25519 + Memo + Transfer) |
| `useTravelRule` | X25519 encryption/decryption of Travel Rule payloads |
| `useAnalytics` | Aggregates oracle stats + on-chain VaspRegistry/RevocationList state |

### Analytics Dashboard

The dashboard displays four metric cards and detailed breakdowns:

- **Attestations Issued** — Total attestations signed by the oracle
- **Registered VASPs** — Count from on-chain VaspRegistry
- **Revoked Wallets** — Count from on-chain RevocationList
- **Merkle Tree Wallets** — Current compliance set size

Plus: KYC level distribution bar chart, Merkle tree operations log, oracle uptime, and Travel Rule threshold.

---

## Cryptographic Design

### Ed25519 Attestation Flow

```
1. Oracle builds 41-byte preimage:
   [wallet_pubkey (32 bytes)] [expiry_timestamp (8 bytes LE)] [kyc_level (1 byte)]

2. Oracle computes:  hash = SHA-256(preimage)

3. Oracle signs:     signature = Ed25519.sign(hash, oracle_secret_key)

4. Client builds transaction with 3 instructions:
   IX 0: Ed25519Program.createInstructionWithPublicKey(oracle_pub, hash, signature)
   IX 1: Memo(encrypted_travel_rule_payload)  ← only if amount ≥ threshold
   IX 2: SCL.transfer_compliant(amount, decimals, wallet, expiry, level)

5. On-chain verification:
   - Introspect IX 0 via SYSVAR_INSTRUCTIONS to extract pubkey, message, signature
   - Verify oracle pubkey ∈ registry.oracle_pubkeys
   - Reconstruct preimage from IX 2 args, hash, compare to IX 0 message
   - Check expiry > Clock::unix_timestamp
   - Check wallet ∉ revocation_list.revoked_wallets
   - If amount ≥ threshold: introspect Memo instruction to verify Travel Rule data
   - Execute Token-2022 transfer_checked CPI
```

### Merkle Proof Verification

```
1. Off-chain tree construction:
   leaf = keccak256(wallet_pubkey_bytes)
   internal_node = keccak256(min(left, right) || max(left, right))

2. Proof generation:
   For each tree level, include the sibling node hash

3. On-chain verification (transfer_compliant_merkle):
   computed = keccak256(sender_pubkey_bytes)
   for each proof_element:
     if computed ≤ proof_element:
       computed = keccak256(computed || proof_element)
     else:
       computed = keccak256(proof_element || computed)
   require!(computed == merkle_root_account.root)
```

### Travel Rule Encryption

Travel Rule payloads are encrypted using the receiver VASP's X25519 public key:

```
1. Sender looks up receiver VASP's encryption_key from VaspRegistry
2. Sender generates ephemeral X25519 keypair
3. Payload encrypted: XSalsa20-Poly1305(payload, shared_secret)
4. Encrypted blob = [ephemeral_pub (32) || nonce (24) || ciphertext]
5. Base64-encoded blob attached as Memo instruction data
6. Receiver VASP decrypts using their X25519 secret key
```

---

## Getting Started

### Prerequisites

- **Rust** ≥ 1.75 with `rustup`
- **Solana CLI** ≥ 1.18
- **Anchor CLI** 0.30.1
- **Node.js** ≥ 18
- **npm** ≥ 9

### Installation

```bash
# Clone the repository
git clone https://github.com/web3-wizard/SCL.git
cd SCL

# Install all dependencies (root, oracle, app)
npm install --legacy-peer-deps

# Install oracle-specific dependencies
cd oracle && npm install && cd ..
```

### Build & Deploy

```bash
# Build the Anchor program
anchor build

# Start a local validator
solana-test-validator

# Deploy to localnet
anchor deploy

# Update the program ID in:
#   - Anchor.toml
#   - programs/scl/src/lib.rs (declare_id!)
#   - app/src/utils/constants.ts (SCL_PROGRAM_ID)
```

### Run the Oracle

```bash
# Development mode (hot-reload)
npm run oracle:dev

# Or directly
cd oracle && npm run dev
```

The oracle starts on `http://localhost:3001`. Health check:

```bash
curl http://localhost:3001/health
```

### Run the Frontend

```bash
# Development mode
npm run app:dev

# Or directly
cd app && npm run dev
```

Opens at `http://localhost:5173`. Connect Phantom wallet (set to devnet or localnet).

### Run Tests

```bash
# Run all 13 test scenarios
anchor test
```

### Run Demo

```bash
# Run the 10-scenario end-to-end demo
npm run demo
```

Requires `solana-test-validator` running and the program deployed.

---

## Configuration

### Environment Variables (Oracle)

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Oracle HTTP port | `3001` |
| `FIREBLOCKS_API_KEY` | Fireblocks API key | — (local signing) |
| `FIREBLOCKS_API_SECRET_PATH` | Path to Fireblocks RSA private key | — |
| `FIREBLOCKS_VAULT_ID` | Fireblocks vault account ID | — |

### Constants (Frontend)

Located in `app/src/utils/constants.ts`:

| Constant | Value | Description |
|----------|-------|-------------|
| `SCL_PROGRAM_ID` | `SC111...` | Deployed program address |
| `MEMO_PROGRAM_ID` | `MemoSq4gqA...` | Solana Memo Program v2 |
| `TOKEN_2022_PROGRAM_ID` | `TokenzQdBN...` | SPL Token-2022 Program |
| `ORACLE_URL` | `http://localhost:3001` | Oracle base URL |
| `TRAVEL_RULE_THRESHOLD` | `1_000_000_000` | 1000 rUSDC (6 decimals) |

---

## Testing

### Test Scenarios (13 total)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Compliant transfer above threshold with Travel Rule | Pass |
| 2 | Transfer without attestation | Fail |
| 3 | Transfer above threshold without Travel Rule memo | Fail |
| 4 | Transfer with expired attestation | Fail |
| 5 | Transfer below threshold (no memo needed) | Pass |
| 6 | Transfer with revoked attestation | Fail |
| 7 | Transfer signed by second oracle | Pass |
| 8 | Attempt to remove last oracle | Fail |
| 9 | VASP proposal → approval flow | Pass |
| 10 | VASP proposal → rejection flow | Pass |
| 11 | Initialize Merkle root PDA | Pass |
| 12 | Transfer with valid Merkle proof | Pass |
| 13 | Transfer with invalid Merkle proof | Fail |

### Demo Scenarios (10 total)

| # | Scenario | Type |
|---|----------|------|
| 1 | Compliant transfer (above threshold) | Happy path |
| 2 | Missing attestation | Error case |
| 3 | Missing Travel Rule payload | Error case |
| 4 | Expired attestation | Error case |
| 5 | Below threshold (no memo needed) | Happy path |
| 6 | Revoked attestation | Error case |
| 7 | Second oracle attestation | Happy path |
| 8 | VASP governance proposal | Happy path |
| 9 | Merkle proof transfer | Happy path |
| 10 | Oracle stats check | Integration |

---

## Security Considerations

- **Demo keypair** — The oracle ships with a hardcoded Ed25519 keypair (`oracle/src/keypair.ts`) for deterministic testing. **Replace with HSM/Fireblocks in production.**
- **Ed25519 introspection** — The program introspects the prior instruction to verify the Ed25519 precompile was invoked. This is the standard Solana pattern but requires the Ed25519 verify instruction to be at a specific position in the transaction.
- **Revocation is owner-only** — Only the registry owner can revoke/unrevoke attestations. Consider multi-sig or DAO governance for production.
- **Merkle tree is in-memory** — The oracle's Merkle tree resets on restart. Production deployments should persist tree state to a database.
- **Token-2022 only** — The program uses `anchor_spl::token_2022::transfer_checked`. Legacy SPL Token transfers are not supported.
- **Travel Rule data** — Encrypted Travel Rule payloads are stored in Memo instructions, which are visible on-chain in encrypted form. Only the recipient VASP can decrypt them.

---

## License

This project is developed under the Solana Compliance Layer specification (SPEC-1-SCL-MVP).
