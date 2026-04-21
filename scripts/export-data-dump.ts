import { mkdirSync, writeFileSync } from "node:fs";
import { peptideRecords, sourceRegistry } from "../src/data/peptide-records";

const lines: string[] = [];

lines.push("peptocopeia compiled data export");
lines.push(`generated_at: ${new Date().toISOString()}`);
lines.push(`peptide_count: ${peptideRecords.length}`);
lines.push(`source_registry_count: ${sourceRegistry.length}`);
lines.push("");
lines.push("source_registry:");

for (const source of sourceRegistry) {
  lines.push(`- id: ${source.id}`);
  lines.push(`  name: ${source.name}`);
  lines.push(`  status: ${source.status}`);
  lines.push(`  use: ${source.use}`);
}

for (const peptide of peptideRecords) {
  lines.push("");
  lines.push("=".repeat(100));
  lines.push(`id: ${peptide.id}`);
  lines.push(`primary_name: ${peptide.names.primary}`);
  lines.push(`aliases: ${peptide.names.aliases.join(" | ") || "none"}`);
  lines.push(`trade_names: ${peptide.names.tradeNames.join(" | ") || "none"}`);
  lines.push(`category: ${peptide.category}`);
  lines.push(`peptide_class: ${peptide.classification.peptideClass}`);
  lines.push(`mechanism_family: ${peptide.classification.mechanismFamily}`);
  lines.push(`evidence_tier: ${peptide.classification.evidenceTier}`);
  lines.push(`regulatory_status: ${peptide.classification.regulatoryStatus}`);
  lines.push(`moderation_status: ${peptide.moderation.status}`);
  lines.push(`moderation_reviewer: ${peptide.moderation.reviewer ?? "none"}`);
  lines.push(`moderation_stale_after: ${peptide.moderation.staleAfter ?? "none"}`);
  lines.push(`moderation_writeup: ${peptide.moderation.verificationWriteup ?? "none"}`);
  lines.push("");
  lines.push("[identity]");
  lines.push(`formula: ${peptide.identity.formula ?? "unknown"}`);
  lines.push(`molecular_weight: ${peptide.identity.molecularWeight ?? "unknown"}`);
  lines.push(`cas: ${peptide.identity.cas ?? "unknown"}`);
  lines.push(`sequence_one_letter: ${peptide.identity.sequenceOneLetter ?? "unknown"}`);
  lines.push(`sequence_three_letter: ${peptide.identity.sequenceThreeLetter ?? "unknown"}`);
  lines.push(`length: ${peptide.identity.length ?? "unknown"}`);
  lines.push(`modifications: ${peptide.identity.modifications.join(" | ") || "none"}`);
  lines.push(`structure_class: ${peptide.identity.structureClass ?? "unknown"}`);
  lines.push("");
  lines.push("[tile]");
  lines.push(`mechanism_summary: ${peptide.tile.mechanismSummary}`);
  lines.push(`localization: ${peptide.tile.localization}`);
  lines.push(`clinical_uses: ${peptide.tile.clinicalUses.join(" | ") || "none"}`);
  lines.push(`side_effects: ${peptide.tile.sideEffects.join(" | ") || "none"}`);
  lines.push(`dosing_quick: ${peptide.tile.dosing.quick}`);
  lines.push(`dosing_admin_route: ${peptide.tile.dosing.adminRoute}`);
  lines.push(`dosing_public_display_allowed: ${peptide.tile.dosing.publicDisplayAllowed}`);
  lines.push(`dosing_context: ${peptide.tile.dosing.context}`);
  lines.push(`cost_range: ${peptide.tile.cost.range ?? "none"}`);
  lines.push(`cost_size: ${peptide.tile.cost.size ?? "none"}`);
  lines.push(`cost_source: ${peptide.tile.cost.source ?? "none"}`);
  lines.push(`cost_vendor_product_url: ${peptide.tile.cost.vendorProductUrl ?? "none"}`);
  lines.push("enhancing_effects:");
  for (const effect of peptide.tile.enhancingEffects) {
    lines.push(`- label: ${effect.label}`);
    lines.push(`  symbols: ${effect.symbols.join(", ") || "none"}`);
    lines.push(`  claim_ref: ${effect.claimRef}`);
  }
  lines.push("");
  lines.push("[biology]");
  lines.push(`genes: ${peptide.biology.genes.join(" | ") || "none"}`);
  lines.push(`proteins: ${peptide.biology.proteins.join(" | ") || "none"}`);
  lines.push(`receptors: ${peptide.biology.receptors.join(" | ") || "none"}`);
  lines.push(`channels_transporters: ${peptide.biology.channelsTransporters.join(" | ") || "none"}`);
  lines.push("cytokines_interleukins:");
  if (peptide.biology.cytokinesInterleukins.length) {
    for (const marker of peptide.biology.cytokinesInterleukins) {
      lines.push(`- name: ${marker.name}`);
      lines.push(`  type: ${marker.type}`);
      lines.push(`  effect: ${marker.effect}`);
      lines.push(`  context: ${marker.context}`);
      lines.push(`  symbols: ${marker.symbols.join(", ") || "none"}`);
      lines.push(`  claim_ref: ${marker.claimRef}`);
    }
  } else {
    lines.push("- none");
  }
  lines.push("cascades:");
  for (const cascade of peptide.biology.cascades) {
    lines.push(`- category: ${cascade.category}`);
    lines.push(`  steps: ${cascade.steps.join(" -> ")}`);
    lines.push(`  symbols: ${cascade.symbols.join(", ") || "none"}`);
    lines.push(`  claim_ref: ${cascade.claimRef}`);
  }
  lines.push("");
  lines.push("[expanded]");
  lines.push(`discovery: ${peptide.expanded.discovery}`);
  lines.push(`human_evidence: ${peptide.expanded.humanEvidence}`);
  lines.push(`animal_evidence: ${peptide.expanded.animalEvidence}`);
  lines.push(`mechanism_detail: ${peptide.expanded.mechanismDetail}`);
  lines.push(`safety_detail: ${peptide.expanded.safetyDetail}`);
  lines.push(`manufacturers: ${peptide.expanded.manufacturers.map((m) => `${m.name} (${m.type}): ${m.notes}`).join(" | ") || "none"}`);
  lines.push(`missing_evidence: ${peptide.expanded.missingEvidence.join(" | ") || "none"}`);
  lines.push(`anecdotal_use: ${peptide.expanded.anecdotalUse.join(" | ") || "none"}`);
  lines.push("");
  lines.push("[vendor_data]");
  if (peptide.vendorData.length) {
    for (const vendor of peptide.vendorData) {
      lines.push(`- vendor: ${vendor.vendor}`);
      lines.push(`  product_name: ${vendor.productName}`);
      lines.push(`  product_url: ${vendor.productUrl ?? "none"}`);
      lines.push(`  vial_size: ${vendor.vialSize ?? "none"}`);
      lines.push(`  price_range: ${vendor.priceRange ?? "none"}`);
      lines.push(`  batch_id: ${vendor.batchId ?? "none"}`);
      lines.push(`  manufacturer_id: ${vendor.manufacturerId ?? "none"}`);
      lines.push(`  purity: ${vendor.purity ?? "none"}`);
      lines.push(`  endotoxin: ${vendor.endotoxin ?? "none"}`);
      lines.push(`  heavy_metals: ${vendor.heavyMetals ?? "none"}`);
      lines.push(`  sterility: ${vendor.sterility ?? "none"}`);
      lines.push(`  lab: ${vendor.lab ?? "none"}`);
      lines.push(`  coa_url: ${vendor.coaUrl ?? "none"}`);
      lines.push(`  date: ${vendor.date ?? "none"}`);
      lines.push(`  symbols: ${vendor.symbols.join(", ") || "none"}`);
    }
  } else {
    lines.push("- none");
  }
  lines.push("");
  lines.push("[claims]");
  for (const claim of peptide.claims) {
    lines.push(`- id: ${claim.id}`);
    lines.push(`  field: ${claim.field}`);
    lines.push(`  value: ${claim.value}`);
    lines.push(`  species: ${claim.species}`);
    lines.push(`  context: ${claim.context}`);
    lines.push(`  population: ${claim.population ?? "none"}`);
    lines.push(`  route: ${claim.route ?? "none"}`);
    lines.push(`  symbols: ${claim.symbols.join(", ") || "none"}`);
    lines.push(`  confidence: ${claim.confidence}`);
    lines.push(`  citation_ids: ${claim.citationIds.join(", ") || "none"}`);
    lines.push(`  needs_moderator_review: ${claim.needsModeratorReview}`);
  }
  lines.push("");
  lines.push("[citations]");
  for (const citation of peptide.citations) {
    lines.push(`- id: ${citation.id}`);
    lines.push(`  source_type: ${citation.sourceType}`);
    lines.push(`  title: ${citation.title}`);
    lines.push(`  authors: ${citation.authors.join(" | ") || "none"}`);
    lines.push(`  year: ${citation.year ?? "none"}`);
    lines.push(`  pmid: ${citation.pmid ?? "none"}`);
    lines.push(`  doi: ${citation.doi ?? "none"}`);
    lines.push(`  url: ${citation.url}`);
    lines.push(`  accessed_at: ${citation.accessedAt}`);
    lines.push(`  quality: ${citation.quality}`);
    lines.push(`  supports_claim_ids: ${citation.supportsClaimIds.join(", ") || "none"}`);
    lines.push(`  notes: ${citation.notes}`);
  }
}

mkdirSync("docs/exports", { recursive: true });
const outputPath = "docs/exports/peptocopeia-compiled-data-2026-04-21.txt";
writeFileSync(outputPath, lines.join("\n"));
console.log(`Wrote ${outputPath}`);
