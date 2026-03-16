import { Router, Request, Response } from "express";
import { createAttestation } from "../services/signer";
import { stats } from "../services/stats";
import { AttestRequest } from "../types";

const router = Router();

router.post("/attest", async (req: Request<{}, {}, AttestRequest>, res: Response) => {
  const { wallet, level } = req.body;

  if (!wallet || typeof wallet !== "string") {
    res.status(400).json({ error: "wallet address is required" });
    return;
  }

  try {
    const attestationLevel = level || 1;
    const attestation = await createAttestation(wallet, attestationLevel);
    stats.recordAttestation(attestationLevel);
    res.json(attestation);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
