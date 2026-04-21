import { mkdirSync, writeFileSync } from "node:fs";
import { evidenceLegend, evidenceTierLabel } from "../src/lib/evidence";
import { peptideRecords, sourceRegistry } from "../src/data/peptide-records";

const output = {
  exportedAt: new Date().toISOString(),
  appName: "peptocopeia",
  sourceRegistry,
  evidenceLegend,
  evidenceTierLabel,
  peptides: peptideRecords
};

const path = "/Users/jacobbudnitz/Downloads/peptocopeia_saved_state_2026-04-21.json";
mkdirSync("/Users/jacobbudnitz/Downloads", { recursive: true });
writeFileSync(path, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${path}`);
