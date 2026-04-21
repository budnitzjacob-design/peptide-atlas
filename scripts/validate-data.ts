import { peptideRecords } from "../src/data/peptide-records";
import { evidenceLegend } from "../src/lib/evidence";

const errors: string[] = [];
const ids = new Set<string>();
const evidenceSymbols = new Set(Object.keys(evidenceLegend));

for (const peptide of peptideRecords) {
  if (ids.has(peptide.id)) errors.push(`duplicate peptide id: ${peptide.id}`);
  ids.add(peptide.id);
  if (!peptide.names.primary) errors.push(`${peptide.id}: missing primary name`);
  if (!peptide.tile.mechanismSummary) errors.push(`${peptide.id}: missing mechanism summary`);
  if (!peptide.tile.localization) errors.push(`${peptide.id}: missing localization`);
  if (!peptide.claims.length) errors.push(`${peptide.id}: no claims`);
  if (!peptide.citations.length) errors.push(`${peptide.id}: no citations`);

  const citationIds = new Set(peptide.citations.map((citation) => citation.id));
  for (const claim of peptide.claims) {
    if (!claim.citationIds.length) errors.push(`${peptide.id}/${claim.id}: claim has no citations`);
    for (const citationId of claim.citationIds) {
      if (!citationIds.has(citationId)) errors.push(`${peptide.id}/${claim.id}: missing citation ${citationId}`);
    }
    for (const symbol of claim.symbols) {
      if (!evidenceSymbols.has(symbol)) errors.push(`${peptide.id}/${claim.id}: unknown evidence symbol ${symbol}`);
    }
    if (/enhancement dose/i.test(claim.value) && !["anecdotal_common_use", "clinical_trial", "fda_label"].includes(claim.context)) {
      errors.push(`${peptide.id}/${claim.id}: enhancement dose lacks context`);
    }
  }

  if (/enhancement dose/i.test(peptide.tile.dosing.quick) && peptide.tile.dosing.context === "unknown") {
    errors.push(`${peptide.id}: enhancement dose display lacks context`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Data ok: ${peptideRecords.length} peptide records, ${peptideRecords.reduce((sum, p) => sum + p.claims.length, 0)} claims.`);
