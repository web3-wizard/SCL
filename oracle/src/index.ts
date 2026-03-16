import express from "express";
import cors from "cors";
import attestRouter from "./routes/attest";
import merkleRouter from "./routes/merkle";
import statsRouter from "./routes/stats";
import { oraclePublicKey } from "./keypair";
import { isFireblocksEnabled } from "./services/fireblocks";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use("/", attestRouter);
app.use("/", merkleRouter);
app.use("/", statsRouter);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    oracle_pubkey: oraclePublicKey.toBase58(),
    signing_mode: isFireblocksEnabled() ? "fireblocks" : "local",
  });
});

app.listen(PORT, () => {
  console.log(`SCL Oracle running on http://localhost:${PORT}`);
  console.log(`Oracle public key: ${oraclePublicKey.toBase58()}`);
  console.log(`Signing mode: ${isFireblocksEnabled() ? "fireblocks" : "local"}`);
});
