import express from "express";
import cors from "cors";
import attestRouter from "./routes/attest";
import { oraclePublicKey } from "./keypair";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use("/", attestRouter);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    oracle_pubkey: oraclePublicKey.toBase58(),
  });
});

app.listen(PORT, () => {
  console.log(`SCL Oracle running on http://localhost:${PORT}`);
  console.log(`Oracle public key: ${oraclePublicKey.toBase58()}`);
});
