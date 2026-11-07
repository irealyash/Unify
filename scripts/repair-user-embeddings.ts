import { config } from "dotenv";
config({ path: ".env.local" });

import { regenerateBothEmbeddings } from "../src/services/embedding.service";

const userId = process.argv[2] || "78dd0c7e-012f-4b1a-9625-c9b31dfda1e3";

async function main() {
  console.log("Regenerating embeddings for", userId);
  await regenerateBothEmbeddings(userId);
  console.log("Done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
