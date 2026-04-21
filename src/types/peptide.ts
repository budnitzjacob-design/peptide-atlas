export type EvidenceSymbol = "Rx" | "H" | "A" | "C" | "R" | "V" | "?" | "N";

export type EvidenceTier =
  | "fda_phase3"
  | "human_phase3"
  | "human_phase2"
  | "human_clinical_development"
  | "human_pk_pd"
  | "human_topical_and_mechanistic"
  | "translational"
  | "preclinical"
  | "secondary_only"
  | "conflict";

export type RegulatoryStatus =
  | "fda_approved"
  | "non_us_approved"
  | "investigational"
  | "research_only"
  | "not_approved"
  | "unknown";

export type ClaimContext =
  | "fda_label"
  | "clinical_trial"
  | "observational"
  | "preclinical"
  | "cell"
  | "review"
  | "vendor"
  | "anecdotal_common_use"
  | "unknown";

export interface Citation {
  id: string;
  sourceType: "pubmed" | "pmc" | "fda_label" | "clinicaltrials" | "consensus" | "peptpedia" | "peptide_partners" | "official_regulator" | "other";
  title: string;
  authors: string[];
  year: number | null;
  pmid?: string | null;
  doi?: string | null;
  url: string;
  accessedAt: string;
  quality: "primary" | "regulatory" | "review" | "secondary" | "vendor";
  supportsClaimIds: string[];
  notes: string;
}

export interface Claim {
  id: string;
  field: string;
  value: string;
  species: "human" | "animal" | "cell" | "mixed" | "not_applicable" | "unknown";
  context: ClaimContext;
  population?: string | null;
  route?: string | null;
  sampleSize?: string | null;
  duration?: string | null;
  symbols: EvidenceSymbol[];
  confidence: number;
  citationIds: string[];
  needsModeratorReview: boolean;
}

export interface PeptideRecord {
  id: string;
  names: {
    primary: string;
    aliases: string[];
    tradeNames: string[];
  };
  category: string;
  classification: {
    peptideClass: string;
    mechanismFamily: string;
    evidenceTier: EvidenceTier;
    regulatoryStatus: RegulatoryStatus;
  };
  identity: {
    formula: string | null;
    molecularWeight: string | null;
    cas: string | null;
    sequenceOneLetter: string | null;
    sequenceThreeLetter: string | null;
    length: string | null;
    modifications: string[];
    structureClass: string | null;
  };
  tile: {
    mechanismSummary: string;
    localization: string;
    enhancingEffects: Array<{ label: string; symbols: EvidenceSymbol[]; claimRef: string }>;
    sideEffects: string[];
    clinicalUses: string[];
    dosing: {
      quick: string;
      adminRoute: string;
      publicDisplayAllowed: boolean;
      context: ClaimContext;
    };
    cost: {
      range: string | null;
      size: string | null;
      source: string | null;
      vendorProductUrl: string | null;
    };
  };
  biology: {
    genes: string[];
    proteins: string[];
    receptors: string[];
    channelsTransporters: string[];
    cytokinesInterleukins: Array<{
      name: string;
      type: "interleukin" | "cytokine" | "chemokine" | "inflammatory_marker" | "growth_factor" | "other";
      effect: string;
      context: string;
      symbols: EvidenceSymbol[];
      claimRef: string;
    }>;
    cascades: Array<{
      category: string;
      steps: string[];
      symbols: EvidenceSymbol[];
      claimRef: string;
    }>;
  };
  expanded: {
    discovery: string;
    humanEvidence: string;
    animalEvidence: string;
    mechanismDetail: string;
    safetyDetail: string;
    safetyRisks: Array<{
      system: string;
      label: string;
      color: string;
      icon: string;
      helpSummary: string | null;
      harmSummary: string | null;
      citationIds: string[];
    }>;
    enhancementPotential: {
      summary: string;
      caveat: string;
      citationIds: string[];
    } | null;
    manufacturers: Array<{ name: string; type: string; notes: string }>;
    missingEvidence: string[];
    anecdotalUse: string[];
  };
  vendorData: Array<{
    vendor: string;
    productName: string;
    productUrl: string | null;
    vialSize: string | null;
    priceRange: string | null;
    batchId: string | null;
    manufacturerId: string | null;
    purity: string | null;
    endotoxin: "conforms" | "does_not_conform" | "unknown" | null;
    heavyMetals: "conforms" | "does_not_conform" | "unknown" | null;
    sterility: "pass" | "fail" | "unknown" | null;
    lab: string | null;
    coaUrl: string | null;
    date: string | null;
    symbols: EvidenceSymbol[];
    sourcePlatform?: string | null;
    ratingGrade?: string | null;
    ratingText?: string | null;
    ratingScore?: number | null;
    ratingScoreMin?: number | null;
    ratingScoreMax?: number | null;
    testCount?: number | null;
    oldestTest?: string | null;
    latestTest?: string | null;
    notes?: string | null;
    sourceTitle?: string | null;
  }>;
  claims: Claim[];
  citations: Citation[];
  moderation: {
    status: "unreviewed" | "model_drafted" | "needs_review" | "verified" | "conflict";
    reviewer: string | null;
    verificationWriteup: string | null;
    staleAfter: string | null;
  };
}

export interface PeptideSummary {
  id: string;
  name: string;
  category: string;
  status: string;
  sources: string[];
}
