import nacl from "tweetnacl";
import { encode as encodeBase64 } from "tweetnacl-util";

/**
 * Generate X25519 keypairs for demo VASPs.
 * Run: npx ts-node scripts/generate-vasp-keys.ts
 */
function generateVaspKeys() {
  const vasps = [
    { name: "AMINA Bank", jurisdiction: "CH" },
    { name: "UBS Digital", jurisdiction: "CH" },
  ];

  console.log("=== VASP X25519 Key Generation ===\n");

  for (const vasp of vasps) {
    const keypair = nacl.box.keyPair();
    console.log(`${vasp.name} (${vasp.jurisdiction}):`);
    console.log(`  Public Key:  ${encodeBase64(keypair.publicKey)}`);
    console.log(`  Secret Key:  ${encodeBase64(keypair.secretKey)}`);
    console.log(`  Public (hex): ${Buffer.from(keypair.publicKey).toString("hex")}`);
    console.log();
  }
}

generateVaspKeys();
