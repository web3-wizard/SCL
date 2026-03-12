import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function WalletConnect() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", padding: "16px" }}>
      <WalletMultiButton />
    </div>
  );
}
