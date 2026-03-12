import { useState, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { WalletConnect } from "./components/WalletConnect";
import { TransferForm } from "./components/TransferForm";
import { ReceiverDashboard } from "./components/ReceiverDashboard";

import "@solana/wallet-adapter-react-ui/styles.css";

type Tab = "send" | "receive";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("send");

  const endpoint = useMemo(() => clusterApiUrl("devnet"), []);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  const tabStyle = (tab: Tab) => ({
    padding: "10px 24px",
    border: "none",
    borderBottom:
      activeTab === tab ? "2px solid #6366f1" : "2px solid transparent",
    background: "transparent",
    color: activeTab === tab ? "#e1e1e6" : "#666",
    fontSize: 15,
    fontWeight: activeTab === tab ? 600 : 400,
    cursor: "pointer" as const,
  });

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div
            style={{
              minHeight: "100vh",
              background: "#0f1117",
              color: "#e1e1e6",
            }}
          >
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 24px",
                borderBottom: "1px solid #1e1e2e",
              }}
            >
              <h1 style={{ fontSize: 20, fontWeight: 700 }}>
                <span style={{ color: "#6366f1" }}>SCL</span> Solana
                Compliance Layer
              </h1>
              <WalletConnect />
            </header>

            <nav
              style={{
                display: "flex",
                gap: 0,
                borderBottom: "1px solid #1e1e2e",
                paddingLeft: 24,
              }}
            >
              <button style={tabStyle("send")} onClick={() => setActiveTab("send")}>
                Send
              </button>
              <button style={tabStyle("receive")} onClick={() => setActiveTab("receive")}>
                Receive
              </button>
            </nav>

            <main style={{ padding: "24px 0" }}>
              {activeTab === "send" && <TransferForm />}
              {activeTab === "receive" && <ReceiverDashboard />}
            </main>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
