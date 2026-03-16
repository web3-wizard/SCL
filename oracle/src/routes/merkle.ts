import { Router, Request, Response } from "express";
import { merkleTree } from "../services/merkle";
import { stats } from "../services/stats";

const router = Router();

router.post("/merkle/add", (req: Request, res: Response) => {
  const { wallet } = req.body;
  if (!wallet || typeof wallet !== "string") {
    res.status(400).json({ error: "wallet address is required" });
    return;
  }

  try {
    if (merkleTree.hasWallet(wallet)) {
      res.status(409).json({ error: "wallet already in tree" });
      return;
    }
    merkleTree.addWallet(wallet);
    stats.recordMerkleWalletAdded();
    res.json({
      wallet,
      root: Array.from(merkleTree.getRoot()),
      tree_size: merkleTree.getSize(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/merkle/remove", (req: Request, res: Response) => {
  const { wallet } = req.body;
  if (!wallet || typeof wallet !== "string") {
    res.status(400).json({ error: "wallet address is required" });
    return;
  }

  try {
    const removed = merkleTree.removeWallet(wallet);
    if (!removed) {
      res.status(404).json({ error: "wallet not found in tree" });
      return;
    }
    stats.recordMerkleWalletRemoved();
    res.json({
      wallet,
      root: Array.from(merkleTree.getRoot()),
      tree_size: merkleTree.getSize(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/merkle/root", (_req: Request, res: Response) => {
  res.json({
    root: Array.from(merkleTree.getRoot()),
    tree_size: merkleTree.getSize(),
  });
});

router.get("/merkle/proof/:wallet", (req: Request, res: Response) => {
  const { wallet } = req.params;

  try {
    if (!merkleTree.hasWallet(wallet)) {
      res.status(404).json({ error: "wallet not found in tree" });
      return;
    }
    const proof = merkleTree.getProof(wallet);
    stats.recordMerkleProofServed();
    res.json({
      wallet,
      proof: proof.map((p) => Array.from(p)),
      root: Array.from(merkleTree.getRoot()),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
