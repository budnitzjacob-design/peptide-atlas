import type { EvidenceSymbol, EvidenceTier } from "@/types/peptide";

export const evidenceLegend: Record<EvidenceSymbol, string> = {
  Rx: "regulatory label or approved-drug source",
  H: "human trial or human clinical data",
  A: "animal model",
  C: "cell or in vitro model",
  R: "review or secondary synthesis",
  V: "vendor or COA source",
  "?": "needs verification or unresolved uncertainty",
  N: "anecdotal/common-use context, not clinical evidence"
};

export const evidenceTierLabel: Record<EvidenceTier, string> = {
  fda_phase3: "FDA / Phase 3",
  human_phase3: "Human Phase 3",
  human_phase2: "Human Phase 2",
  human_clinical_development: "Human clinical",
  human_pk_pd: "Human PK/PD",
  human_topical_and_mechanistic: "Human topical + mechanism",
  translational: "Translational",
  preclinical: "Preclinical",
  secondary_only: "Secondary only",
  conflict: "Conflict"
};

export function evidenceClass(tier: EvidenceTier) {
  if (tier.includes("fda") || tier.includes("phase3")) return "high";
  if (tier.includes("human")) return "human";
  if (tier === "conflict") return "conflict";
  return "early";
}
