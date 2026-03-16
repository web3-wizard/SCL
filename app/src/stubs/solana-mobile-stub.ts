// Stub for @solana-mobile/mobile-wallet-adapter-protocol
// This module is only needed for mobile wallets, not desktop web browsers

export const transact = () => {
  throw new Error("Mobile wallet adapter not supported in web browser");
};

export const startRemoteScenario = () => {
  throw new Error("Mobile wallet adapter not supported in web browser");
};
