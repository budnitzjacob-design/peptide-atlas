import type { Citation, Claim, EvidenceSymbol, PeptideRecord } from "@/types/peptide";
import vendorBatchRaw from "../../data/sources/vendors/peptocopeia_batch_1.json";
import vendorBatch2Raw from "../../data/sources/vendors/peptocopeia_batch_2.json";

const accessedAt = "2026-04-21";

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

const baseCitations: Record<string, Citation> = {
  peptpedia: {
    id: "src-peptpedia-browse",
    sourceType: "peptpedia",
    title: "Peptpedia peptide browse index",
    authors: ["Peptpedia"],
    year: 2026,
    url: "https://peptpedia.org/browse",
    accessedAt,
    quality: "secondary",
    supportsClaimIds: [],
    notes: "Secondary discovery/index source used for roster, class, and overview discovery only."
  },
  peptidePartnersShop: {
    id: "src-peptide-partners-shop",
    sourceType: "peptide_partners",
    title: "Peptide Partners shop",
    authors: ["Peptide Partners"],
    year: 2026,
    url: "https://peptide.partners/shop/",
    accessedAt,
    quality: "vendor",
    supportsClaimIds: [],
    notes: "Vendor product, vial-size, and cost discovery only; not used for efficacy or clinical safety."
  },
  peptidePartnersCerts: {
    id: "src-peptide-partners-certifications",
    sourceType: "peptide_partners",
    title: "Peptide Partners independent certifications",
    authors: ["Peptide Partners"],
    year: 2026,
    url: "https://peptide.partners/independent-certifications/",
    accessedAt,
    quality: "vendor",
    supportsClaimIds: [],
    notes: "Vendor purity/endotoxin/heavy-metal/sterility/batch discovery only."
  }
};

const source = (key: keyof typeof baseCitations) => baseCitations[key];

type VendorBatch = {
  retrieved_date: string;
  source_run_id: string;
  peptides: Array<{
    peptide_id: string;
    peptide_name: string;
    finnrick_summary?: {
      total_tests?: number;
      vendor_count?: number;
      first_test?: string;
      last_test?: string;
      purity_5_95_pct?: [number, number];
      quantity_divergence_95pct?: string;
      capture_note?: string;
      note?: string;
      note_top3?: string;
      variant_note?: string;
    };
    vendor_observations: Array<{
      vendor: string;
      vendor_slug?: string | null;
      manufacturer?: string | null;
      product_name: string;
      product_url: string | null;
      source_platform: string;
      vial_size: string | null;
      price: { raw?: string | null } | null;
      quantity: string | null;
      availability: string | null;
      shipping_region: string | null;
      lab_results?: Array<{
        batch_id: string | null;
        test_date: string | null;
        lab: string | null;
        coa_url: string | null;
        purity: string | null;
        quantity_assay: string | null;
        endotoxin: "conforms" | "does_not_conform" | "unknown" | null;
        heavy_metals: "conforms" | "does_not_conform" | "unknown" | null;
        sterility: "pass" | "fail" | "unknown" | null;
        other_tests: string | null;
        flags: string[];
      }>;
      ratings?: {
        finnrick_grade?: string | null;
        finnrick_grade_text?: string | null;
        finnrick_score?: number | null;
        finnrick_score_min?: number | null;
        finnrick_score_max?: number | null;
        finnrick_test_count?: number | null;
        finnrick_oldest_test?: string | null;
        finnrick_latest_test?: string | null;
        peptidetracker_rating?: number | null;
        review_count?: number | null;
        satisfaction_summary?: string | null;
        sentiment_score?: number | null;
        complaints?: string[] | null;
      };
      source_snapshot?: {
        title?: string | null;
        url?: string | null;
        notes?: string | null;
        retrieved_date?: string | null;
        access?: string | null;
        pass2_detail_url?: string | null;
        fraud_note?: string | null;
        staleness_note?: string | null;
      };
    }>;
  }>;
};

const vendorBatch1 = vendorBatchRaw as VendorBatch;
const vendorBatch2 = vendorBatch2Raw as VendorBatch;

function vendorBatchFor(peptideId: string) {
  return (
    [vendorBatch2, vendorBatch1]
      .map((batch) => ({ batch, peptide: batch.peptides.find((item) => item.peptide_id === peptideId) }))
      .find((item) => item.peptide) ?? null
  );
}

function vendorNotes(peptideId: string) {
  const match = vendorBatchFor(peptideId);
  if (!match?.peptide?.finnrick_summary) return [];
  const { batch, peptide: batchPeptide } = match;
  const summary = batchPeptide.finnrick_summary;
  const purity = summary.purity_5_95_pct?.length === 2 ? `${summary.purity_5_95_pct[0]}%-${summary.purity_5_95_pct[1]}% purity 5th-95th percentile` : null;
  const trackerSignals = batchPeptide.vendor_observations
    .map((entry) =>
      [
        entry.ratings?.peptidetracker_rating != null ? `PeptideTracker ${entry.ratings.peptidetracker_rating}/5` : null,
        entry.ratings?.review_count != null ? `${entry.ratings.review_count} review(s)` : null,
        entry.ratings?.satisfaction_summary || null
      ]
        .filter(Boolean)
        .join(", ")
    )
    .filter(Boolean);
  return [
    `Finnrick batch summary (${batch.retrieved_date}): ${summary.vendor_count ?? "unknown"} vendors, ${summary.total_tests ?? "unknown"} tests, first test ${summary.first_test ?? "unknown"}, latest test ${summary.last_test ?? "unknown"}.`,
    purity,
    summary.quantity_divergence_95pct ? `Quantity divergence 95th percentile window: ${summary.quantity_divergence_95pct}.` : null,
    summary.capture_note ?? null,
    summary.note ?? null,
    summary.note_top3 ?? null,
    summary.variant_note ?? null,
    trackerSignals.length ? `Imported tracker/vendor sentiment signals: ${trackerSignals.slice(0, 3).join(" | ")}.` : null
  ].filter(Boolean) as string[];
}

function finnrickVendorRows(peptideId: string): PeptideRecord["vendorData"] {
  const match = vendorBatchFor(peptideId);
  if (!match?.peptide) return [];
  const { peptide: batchPeptide } = match;
  return batchPeptide.vendor_observations.map((entry) => {
    const labSummary = entry.lab_results?.[0];
    const issueNotes = [
      labSummary?.other_tests,
      entry.ratings?.satisfaction_summary,
      entry.ratings?.complaints?.length ? `Complaints: ${entry.ratings.complaints.join("; ")}` : null,
      entry.source_snapshot?.notes,
      entry.source_snapshot?.fraud_note,
      entry.source_snapshot?.staleness_note
    ]
      .filter(Boolean)
      .join(" ");
    return {
      vendor: entry.vendor,
      productName: entry.product_name,
      productUrl: entry.product_url,
      vialSize: entry.vial_size,
      priceRange: entry.price?.raw ?? null,
      batchId: labSummary?.batch_id ?? null,
      manufacturerId: entry.manufacturer ?? null,
      purity: labSummary?.purity ?? null,
      endotoxin: labSummary?.endotoxin ?? null,
      heavyMetals: labSummary?.heavy_metals ?? null,
      sterility: labSummary?.sterility ?? null,
      lab: labSummary?.lab ?? null,
      coaUrl: labSummary?.coa_url ?? entry.product_url ?? null,
      date: labSummary?.test_date ?? null,
      symbols: ["V"],
      sourcePlatform: entry.source_platform,
      ratingGrade: entry.ratings?.finnrick_grade ?? null,
      ratingText: entry.ratings?.finnrick_grade_text ?? null,
      ratingScore: entry.ratings?.finnrick_score ?? null,
      ratingScoreMin: entry.ratings?.finnrick_score_min ?? null,
      ratingScoreMax: entry.ratings?.finnrick_score_max ?? null,
      testCount: entry.ratings?.finnrick_test_count ?? null,
      oldestTest: entry.ratings?.finnrick_oldest_test ?? null,
      latestTest: entry.ratings?.finnrick_latest_test ?? null,
      notes: issueNotes || null,
      sourceTitle: entry.source_snapshot?.title ?? null
    };
  });
}

const catalog = [
  ["aod-9604", "AOD-9604", "Metabolic", "hGH fragment", "lipolysis / beta-adrenergic metabolic signaling"],
  ["bpc-157", "BPC-157", "Recovery & Repair", "gastric pentadecapeptide", "angiogenesis and tissue repair signaling"],
  ["cagrilintide", "Cagrilintide", "Metabolic", "amylin analog", "amylin receptor appetite and satiety signaling"],
  ["cerebrolysin", "Cerebrolysin", "Cognitive Enhancement", "neurotrophic peptide mixture", "neurotrophic and neuronal survival signaling"],
  ["cjc-1295", "CJC-1295", "Growth Factors", "GHRH analog", "pituitary GHRH receptor and GH/IGF-1 axis"],
  ["dihexa", "Dihexa", "Cognitive Enhancement", "angiotensin IV analog", "HGF/c-Met synaptogenic signaling"],
  ["dsip", "DSIP", "Sleep & Relaxation", "sleep-related neuropeptide", "sleep and HPA-axis associated signaling"],
  ["epithalon", "Epithalon", "Anti-Aging", "pineal tetrapeptide", "telomerase and gene-expression hypotheses"],
  ["follistatin-344", "Follistatin 344", "Growth Factors", "activin/myostatin binding protein", "myostatin/activin sequestration"],
  ["foxo4-dri", "FOXO4-DRI", "Anti-Aging", "D-retro-inverso senolytic peptide", "FOXO4-p53 senescence signaling"],
  ["ghk-cu", "GHK-Cu", "Anti-Aging", "copper tripeptide", "extracellular-matrix and wound remodeling"],
  ["ghrp-2", "GHRP-2", "Growth Factors", "GH secretagogue", "GHSR ghrelin receptor and GH pulse signaling"],
  ["ghrp-6", "GHRP-6", "Growth Factors", "GH secretagogue", "GHSR ghrelin receptor and appetite/GH signaling"],
  ["hexarelin", "Hexarelin", "Growth Factors", "GH secretagogue", "GHSR and CD36-associated cardiac signaling"],
  ["humanin", "Humanin", "Mitochondrial", "mitochondrial-derived peptide", "mitochondrial stress and neuroprotection signaling"],
  ["igf-1-lr3", "IGF-1 LR3", "Growth Factors", "IGF analog", "IGF-1 receptor PI3K/Akt/mTOR signaling"],
  ["ipamorelin", "Ipamorelin", "Growth Factors", "selective GH secretagogue", "GHSR and pituitary GH pulse signaling"],
  ["kisspeptin", "Kisspeptin", "Reproductive / Metabolic", "neuropeptide", "KISS1R/GPR54 and GnRH release"],
  ["kpv", "KPV", "Immune Support", "alpha-MSH tripeptide", "melanocortin and NF-kB inflammatory signaling"],
  ["liraglutide", "Liraglutide", "Metabolic", "GLP-1 receptor agonist", "GLP-1 receptor incretin signaling"],
  ["ll-37", "LL-37", "Immune Support", "cathelicidin antimicrobial peptide", "innate immunity, antimicrobial, and cytokine modulation"],
  ["mazdutide", "Mazdutide", "Metabolic", "GLP-1/glucagon dual agonist", "GLP-1 and glucagon receptor metabolic signaling"],
  ["melanotan-ii", "Melanotan II", "Melanocortin / Metabolic", "melanocortin agonist", "MC1R/MC3R/MC4R melanocortin signaling"],
  ["mots-c", "MOTS-c", "Mitochondrial", "mitochondrial-derived peptide", "AMPK and metabolic stress signaling"],
  ["orforglipron", "Orforglipron", "Metabolic", "oral non-peptide GLP-1R agonist", "GLP-1 receptor metabolic signaling"],
  ["oxytocin", "Oxytocin", "Cognitive Enhancement", "neuropeptide hormone", "oxytocin receptor social/reproductive signaling"],
  ["pinealon", "Pinealon", "Anti-Aging", "short peptide", "neuroendocrine/aging hypotheses"],
  ["pramlintide", "Pramlintide", "Metabolic", "amylin analog", "amylin receptor satiety and gastric-emptying signaling"],
  ["pt-141", "PT-141", "Melanocortin / Metabolic", "melanocortin agonist", "central MC3R/MC4R signaling"],
  ["retatrutide", "Retatrutide", "Metabolic", "GLP-1/GIP/glucagon triple agonist", "multi-incretin and glucagon receptor metabolic signaling"],
  ["selank", "Selank", "Cognitive Enhancement", "tuftsin analog", "anxiolytic and neuroimmune signaling hypotheses"],
  ["semaglutide", "Semaglutide", "Metabolic", "GLP-1 receptor agonist", "GLP-1 receptor incretin signaling"],
  ["semax", "Semax", "Cognitive Enhancement", "ACTH(4-10) analog", "BDNF/trkB and neuroprotective signaling"],
  ["sermorelin", "Sermorelin", "Growth Factors", "GHRH(1-29) analog", "GHRH receptor and endogenous GH release"],
  ["snap-8", "SNAP-8", "Anti-Aging", "cosmetic SNARE-modulating peptide", "SNARE complex mimicry in topical/cosmetic context"],
  ["ss-31", "SS-31", "Mitochondrial", "cardiolipin-targeting tetrapeptide", "inner mitochondrial membrane and cardiolipin stabilization"],
  ["survodutide", "Survodutide", "Metabolic", "GLP-1/glucagon dual agonist", "GLP-1 and glucagon receptor metabolic signaling"],
  ["tb-500", "TB-500", "Recovery & Repair", "thymosin beta-4 related peptide", "actin binding, cell migration, and repair signaling"],
  ["tb4-frag", "TB4-FRAG", "Recovery & Repair", "thymosin beta-4 fragment", "TGF-beta and anti-fibrotic remodeling hypotheses"],
  ["teduglutide", "Teduglutide", "Metabolic", "GLP-2 analog", "GLP-2 receptor intestinal adaptation signaling"],
  ["tesamorelin", "Tesamorelin", "Metabolic", "GHRH analog", "GHRH receptor, GH, IGF-1, and visceral adiposity signaling"],
  ["thymosin-alpha-1", "Thymosin Alpha-1", "Immune Support", "thymic immune peptide", "TLR, interferon, and T-cell immune modulation"],
  ["thymulin", "Thymulin", "Immune Support", "zinc-dependent thymic nonapeptide", "T-cell differentiation and thymic endocrine signaling"],
  ["tirzepatide", "Tirzepatide", "Metabolic", "GLP-1/GIP dual agonist", "GLP-1 and GIP incretin receptor signaling"],
  ["vip", "VIP", "Immune Support", "vasoactive neuropeptide", "VPAC receptor anti-inflammatory and vasodilatory signaling"]
] as const;

function claim(
  id: string,
  field: string,
  value: string,
  symbols: EvidenceSymbol[],
  citationIds: string[],
  context: Claim["context"] = "review",
  species: Claim["species"] = "mixed",
  confidence = 0.45,
  meta: Partial<Pick<Claim, "population" | "route" | "sampleSize" | "duration">> = {}
): Claim {
  return {
    id,
    field,
    value,
    species,
    context,
    population: meta.population ?? null,
    route: meta.route ?? null,
    sampleSize: meta.sampleSize ?? null,
    duration: meta.duration ?? null,
    symbols,
    confidence,
    citationIds,
    needsModeratorReview: true
  };
}

function baseRecord(row: (typeof catalog)[number]): PeptideRecord {
  const [id, name, category, peptideClass, mechanismFamily] = row;
  const baseClaim = `${id}-mechanism-seed`;
  return {
    id,
    names: { primary: name, aliases: [], tradeNames: [] },
    category,
    classification: {
      peptideClass,
      mechanismFamily,
      evidenceTier: "secondary_only",
      regulatoryStatus: "unknown"
    },
    identity: {
      formula: null,
      molecularWeight: null,
      cas: null,
      sequenceOneLetter: null,
      sequenceThreeLetter: null,
      length: null,
      modifications: [],
      structureClass: null
    },
    tile: {
      mechanismSummary: `${name} is tracked as a ${peptideClass}; current mechanism text is a source-indexed draft centered on ${mechanismFamily}.`,
      localization: "Localization requires primary-source extraction; current record is model-drafted and queued for review.",
      enhancingEffects: [{ label: mechanismFamily, symbols: ["R", "?"], claimRef: baseClaim }],
      sideEffects: ["Safety/adverse-event fields require primary-source extraction and moderator review."],
      clinicalUses: ["Clinical use context not yet verified for this record."],
      dosing: {
        quick: "No dosing context verified yet. Do not use as guidance.",
        adminRoute: "Pending source extraction. Enhancement/common-use reports, if added, must be marked anecdotal/common-use and non-clinical.",
        publicDisplayAllowed: false,
        context: "unknown"
      },
      cost: {
        range: null,
        size: null,
        source: null,
        vendorProductUrl: null
      }
    },
    biology: {
      genes: [],
      proteins: [],
      receptors: [],
      channelsTransporters: [],
      cytokinesInterleukins: [],
      cascades: [{ category: category.toLowerCase(), steps: [peptideClass, mechanismFamily, "field-level source extraction pending"], symbols: ["R", "?"], claimRef: baseClaim }]
    },
    expanded: {
      discovery: "Discovery/development history requires source extraction.",
      humanEvidence: "No curated human evidence summary has been published from the source pipeline yet.",
      animalEvidence: "No curated animal evidence summary has been published from the source pipeline yet.",
      mechanismDetail: "Mechanism detail is a model-drafted seed and must be checked by another model and a human moderator.",
      safetyDetail: "Safety detail pending source extraction; do not infer safety from absence of listed adverse events.",
      safetyRisks: [],
      enhancementPotential: null,
      manufacturers: [],
      missingEvidence: ["primary citations", "regulatory status", "human outcomes", "safety/adverse events", "PK/PD", "cytokines/interleukins"],
      anecdotalUse: []
    },
    vendorData: [],
    claims: [claim(baseClaim, "tile.mechanismSummary", `${peptideClass}; ${mechanismFamily}`, ["R", "?"], [source("peptpedia").id])],
    citations: [source("peptpedia")],
    moderation: {
      status: "model_drafted",
      reviewer: null,
      verificationWriteup: null,
      staleAfter: "2026-07-21"
    }
  };
}

function mergeRecord(base: PeptideRecord, patch: DeepPartial<PeptideRecord>): PeptideRecord {
  return {
    ...base,
    ...patch,
    names: { ...base.names, ...patch.names },
    classification: { ...base.classification, ...patch.classification },
    identity: { ...base.identity, ...patch.identity },
    tile: { ...base.tile, ...patch.tile, dosing: { ...base.tile.dosing, ...patch.tile?.dosing }, cost: { ...base.tile.cost, ...patch.tile?.cost } },
    biology: { ...base.biology, ...patch.biology },
    expanded: { ...base.expanded, ...patch.expanded },
    citations: patch.citations ?? base.citations,
    claims: patch.claims ?? base.claims,
    vendorData: patch.vendorData ?? base.vendorData,
    moderation: { ...base.moderation, ...patch.moderation }
  };
}

const fdaTirzepatide: Citation = {
  id: "fda-zepbound-2023",
  sourceType: "fda_label",
  title: "FDA Approves New Medication for Chronic Weight Management",
  authors: ["U.S. Food and Drug Administration"],
  year: 2023,
  url: "https://www.fda.gov/news-events/press-announcements/fda-approves-new-medication-chronic-weight-management",
  accessedAt,
  quality: "regulatory",
  supportsClaimIds: ["tirzepatide-fda-use"],
  notes: "Official FDA page describing Zepbound approval, once-weekly subcutaneous administration, and target maintenance dose range."
};

const fdaLiraglutide: Citation = {
  id: "fda-liraglutide-victoza",
  sourceType: "fda_label",
  title: "Liraglutide marketed as Victoza information",
  authors: ["U.S. Food and Drug Administration"],
  year: 2026,
  url: "https://www.fda.gov/drugs/postmarket-drug-safety-information-patients-and-providers/liraglutide-marketed-victoza-information",
  accessedAt,
  quality: "regulatory",
  supportsClaimIds: ["liraglutide-fda-use"],
  notes: "FDA page stating Victoza is approved as adjunct to diet and exercise for glycemic control in adults with type 2 diabetes."
};

const tesamorelinPubMed: Citation = {
  id: "pmid-38905488",
  sourceType: "pubmed",
  title: "Efficacy and safety of tesamorelin in people with HIV on integrase inhibitors",
  authors: ["PubMed indexed authors"],
  year: 2024,
  pmid: "38905488",
  url: "https://pubmed.ncbi.nlm.nih.gov/38905488/",
  accessedAt,
  quality: "primary",
  supportsClaimIds: ["tesamorelin-human-use"],
  notes: "Randomized clinical-trial analysis in people with HIV; notes FDA-approved therapy for abdominal fat accumulation in PWH."
};

const thymosinMeta: Citation = {
  id: "pmid-40599771",
  sourceType: "pubmed",
  title: "Thymosin alpha 1 alleviates inflammation and prevents infection in patients with severe acute pancreatitis through immune regulation",
  authors: ["PubMed indexed authors"],
  year: 2025,
  pmid: "40599771",
  url: "https://pubmed.ncbi.nlm.nih.gov/40599771/",
  accessedAt,
  quality: "review",
  supportsClaimIds: ["ta1-immune-modulation"],
  notes: "Systematic review/meta-analysis; useful for immune endpoints but requires field-level checking."
};

const ll37Ifn: Citation = {
  id: "pmid-19812202",
  sourceType: "pubmed",
  title: "Human cathelicidin peptide LL-37 modulates the effects of IFN-gamma on APCs",
  authors: ["PubMed indexed authors"],
  year: 2009,
  pmid: "19812202",
  url: "https://pubmed.ncbi.nlm.nih.gov/19812202/",
  accessedAt,
  quality: "primary",
  supportsClaimIds: ["ll37-ifng-modulation"],
  notes: "Cellular immune study reporting LL-37 modulation of IFN-gamma responses in antigen-presenting cells."
};

const ll37Neutrophil: Citation = {
  id: "pmid-20140902",
  sourceType: "pubmed",
  title: "The antimicrobial peptide LL-37 modulates the inflammatory and host defense response of human neutrophils",
  authors: ["PubMed indexed authors"],
  year: 2010,
  pmid: "20140902",
  url: "https://pubmed.ncbi.nlm.nih.gov/20140902/",
  accessedAt,
  quality: "primary",
  supportsClaimIds: ["ll37-neutrophil-cytokines"],
  notes: "Human neutrophil in vitro study measuring cytokine release after microbial stimulation."
};

const motsCellMetab: Citation = {
  id: "pmid-25738459",
  sourceType: "pubmed",
  title: "The mitochondrial-derived peptide MOTS-c promotes metabolic homeostasis and reduces obesity and insulin resistance",
  authors: ["Changhan Lee", "Jennifer Zeng", "Brian G. Drew", "Pinchas Cohen"],
  year: 2015,
  pmid: "25738459",
  url: "https://pubmed.ncbi.nlm.nih.gov/25738459/",
  accessedAt,
  quality: "primary",
  supportsClaimIds: ["motsc-ampk-folate"],
  notes: "Cell Metabolism primary paper: skeletal-muscle-targeted MOTS-c inhibited the folate cycle and de novo purine synthesis, activating AMPK and improving insulin resistance/obesity phenotypes in mice."
};

const motsAppl1: Citation = {
  id: "pmid-32880686",
  sourceType: "pubmed",
  title: "Adiponectin treatment improves insulin resistance in mice by regulating the expression of the mitochondrial-derived peptide MOTS-c and its response to exercise via APPL1-SIRT1-PGC-1α",
  authors: ["Qi Guo", "PubMed indexed authors"],
  year: 2020,
  pmid: "32880686",
  url: "https://pubmed.ncbi.nlm.nih.gov/32880686/",
  accessedAt,
  quality: "primary",
  supportsClaimIds: ["motsc-appl1-axis"],
  notes: "Primary mouse/C2C12 study linking adiponectin signaling to MOTS-c production via APPL1-SIRT1-PGC-1alpha in skeletal muscle."
};

const motsCk2: Citation = {
  id: "pmid-39559755",
  sourceType: "pubmed",
  title: "MOTS-c modulates skeletal muscle function by directly binding and activating CK2",
  authors: ["Hiroshi Kumagai", "PubMed indexed authors"],
  year: 2024,
  pmid: "39559755",
  doi: "10.1016/j.isci.2024.111212",
  url: "https://pubmed.ncbi.nlm.nih.gov/39559755/",
  accessedAt,
  quality: "primary",
  supportsClaimIds: ["motsc-ck2-target"],
  notes: "Primary iScience paper identifying CK2 as a direct functional MOTS-c target in skeletal muscle, with muscle glucose-uptake and atrophy readouts in mice."
};

const motsNrf2: Citation = {
  id: "pmid-34859377",
  sourceType: "pubmed",
  title: "The Mitochondrial-Derived Peptide MOTS-c Attenuates Oxidative Stress Injury and the Inflammatory Response of H9c2 Cells Through the Nrf2/ARE and NF-kB Pathways",
  authors: ["PubMed indexed authors"],
  year: 2021,
  pmid: "34859377",
  url: "https://pubmed.ncbi.nlm.nih.gov/34859377/",
  accessedAt,
  quality: "primary",
  supportsClaimIds: ["motsc-nrf2-nfkb"],
  notes: "Primary cell study reporting MOTS-c activation of Nrf2/ARE signaling with reduced NF-kB-p65 phosphorylation in oxidative-stress conditions."
};

const bpcBurn: Citation = {
  id: "pmid-25995620",
  sourceType: "pubmed",
  title: "Body protective compound-157 enhances alkali-burn wound healing in vivo and promotes proliferation, migration, and angiogenesis in vitro",
  authors: ["Tonglie Huang", "PubMed indexed authors"],
  year: 2015,
  pmid: "25995620",
  doi: "10.2147/DDDT.S82030",
  url: "https://pubmed.ncbi.nlm.nih.gov/25995620/",
  accessedAt,
  quality: "primary",
  supportsClaimIds: ["bpc157-vegf-erk"],
  notes: "Primary rat/HUVEC study reporting increased VEGF-A expression, endothelial migration/tube formation, and ERK1/2-c-Fos-c-Jun-Egr-1 signaling after BPC-157."
};

const bpcAngiogenesis: Citation = {
  id: "pmid-20388964",
  sourceType: "pubmed",
  title: "Modulatory effect of gastric pentadecapeptide BPC 157 on angiogenesis in muscle and tendon healing",
  authors: ["PubMed indexed authors"],
  year: 2010,
  pmid: "20388964",
  url: "https://pubmed.ncbi.nlm.nih.gov/20388964/",
  accessedAt,
  quality: "primary",
  supportsClaimIds: ["bpc157-tendon-angiogenesis"],
  notes: "Primary rat healing paper describing modulated angiogenesis in muscle/tendon repair with VEGF, CD34, and factor VIII immunohistochemistry."
};

const bpcClopidogrel: Citation = {
  id: "pmid-33376304",
  sourceType: "pubmed",
  title: "Clopidogrel-Induced Gastric Injury in Rats is Attenuated by Stable Gastric Pentadecapeptide BPC 157",
  authors: ["PubMed indexed authors"],
  year: 2020,
  pmid: "33376304",
  url: "https://pubmed.ncbi.nlm.nih.gov/33376304/",
  accessedAt,
  quality: "primary",
  supportsClaimIds: ["bpc157-no-vegfr1"],
  notes: "Primary rat gastric-injury study linking BPC-157 effects to VEGF-A/VEGFR1-AKT/p38-MAPK signaling, eNOS preservation, and reduced inflammation/apoptotic stress."
};

const bpcMyotendinous: Citation = {
  id: "pmid-34829776",
  sourceType: "pubmed",
  title: "Stable Gastric Pentadecapeptide BPC 157 as a Therapy for the Disable Myotendinous Junctions in Rats",
  authors: ["PubMed indexed authors"],
  year: 2021,
  pmid: "34829776",
  url: "https://pubmed.ncbi.nlm.nih.gov/34829776/",
  accessedAt,
  quality: "primary",
  supportsClaimIds: ["bpc157-eNOS-cox2"],
  notes: "Primary rat myotendinous-junction study reporting counteraction of oxidative stress and nitric-oxide-system changes, including eNOS and COX-2 mRNA effects."
};

const ghkPulmonaryFibrosis: Citation = {
  id: "pmid-31809714",
  sourceType: "pubmed",
  title: "Protective effects of GHK-Cu in bleomycin-induced pulmonary fibrosis via anti-oxidative stress and anti-inflammation pathways",
  authors: ["PubMed indexed authors"],
  year: 2019,
  pmid: "31809714",
  url: "https://pubmed.ncbi.nlm.nih.gov/31809714/",
  accessedAt,
  quality: "primary",
  supportsClaimIds: ["ghkcu-nrf2-smad"],
  notes: "Primary mouse pulmonary-fibrosis study reporting reduced TNF-alpha and IL-6, partial correction of MMP-9/TIMP-1 imbalance, and effects on Nrf2, NF-kB, and TGF-beta1/Smad2/3 pathways."
};

const ghkKeratinocyte: Citation = {
  id: "pmid-19319546",
  sourceType: "pubmed",
  title: "Copper-GHK increases integrin expression and p63 positivity by keratinocytes",
  authors: ["PubMed indexed authors"],
  year: 2009,
  pmid: "19319546",
  url: "https://pubmed.ncbi.nlm.nih.gov/19319546/",
  accessedAt,
  quality: "primary",
  supportsClaimIds: ["ghkcu-integrin-epithelium"],
  notes: "Primary keratinocyte study describing increased integrin expression and a reparative epithelial phenotype in copper-GHK-treated cells."
};

const tb4Mmp: Citation = {
  id: "pmid-16607611",
  sourceType: "pubmed",
  title: "Thymosin beta4 promotes matrix metalloproteinase expression during wound repair",
  authors: ["PubMed indexed authors"],
  year: 2006,
  pmid: "16607611",
  doi: "10.1002/jcp.20650",
  url: "https://pubmed.ncbi.nlm.nih.gov/16607611/",
  accessedAt,
  quality: "primary",
  supportsClaimIds: ["tb500-tb4-mmp-remodeling"],
  notes: "Primary wound-repair study reporting increased MMP-1, MMP-2, and MMP-9 in keratinocytes, endothelial cells, fibroblasts, and monocytes after thymosin beta-4 exposure."
};

const tb4Inflammation: Citation = {
  id: "pmid-21343177",
  sourceType: "pubmed",
  title: "Thymosin beta4 inhibits TNF-alpha-induced NF-kappaB activation, IL-8 expression, and the sensitizing effects by its partners PINCH-1 and ILK",
  authors: ["PubMed indexed authors"],
  year: 2011,
  pmid: "21343177",
  url: "https://pubmed.ncbi.nlm.nih.gov/21343177/",
  accessedAt,
  quality: "primary",
  supportsClaimIds: ["tb500-tb4-nfkb-il8"],
  notes: "Primary cell study reporting thymosin beta-4 inhibition of RelA/p65 NF-kB activation and downstream IL-8 transcription after TNF-alpha stimulation."
};

const tb4VegfAkt: Citation = {
  id: "pmid-25204972",
  sourceType: "pubmed",
  title: "Controlled release of thymosin beta 4 using a collagen-chitosan sponge scaffold augments cutaneous wound healing and increases angiogenesis in diabetic rats with hindlimb ischemia",
  authors: ["PubMed indexed authors"],
  year: 2014,
  pmid: "25204972",
  url: "https://pubmed.ncbi.nlm.nih.gov/25204972/",
  accessedAt,
  quality: "primary",
  supportsClaimIds: ["tb500-tb4-vegf-akt"],
  notes: "Primary diabetic-rat/HUVEC study reporting improved wound healing, increased angiogenesis, downregulated inflammatory genes, and VEGF/AKT-pathway-linked endothelial migration."
};

const ss31Consensus: Citation = {
  id: "consensus-ss31-karaa-2018",
  sourceType: "consensus",
  title: "Randomized dose-escalation trial of elamipretide in adults with primary mitochondrial myopathy",
  authors: ["A. Karaa", "R. Haas", "A. Goldstein", "J. Vockley", "W. Weaver", "B. Cohen"],
  year: 2018,
  doi: "10.1212/wnl.0000000000005255",
  url: "https://consensus.app/papers/randomized-doseescalation-trial-of-elamipretide-in-karaa-haas/354ba5d3c1b35dbfb8dba59ad7d954ba/",
  accessedAt,
  quality: "primary",
  supportsClaimIds: ["ss31-human-exercise"],
  notes: "Consensus CSV row: phase I/II multicenter randomized double-blind placebo-controlled trial in 36 adults with primary mitochondrial myopathy."
};

const ss31Membrane: Citation = {
  id: "doi-10-1074-jbc-ra119-012094",
  sourceType: "other",
  title: "The mitochondria-targeted peptide SS-31 binds lipid bilayers and modulates surface electrostatics as a key component of its mechanism of action",
  authors: ["W. Mitchell", "PubMed indexed authors"],
  year: 2020,
  doi: "10.1074/jbc.ra119.012094",
  url: "https://doi.org/10.1074/JBC.RA119.012094",
  accessedAt,
  quality: "primary",
  supportsClaimIds: ["ss31-cardiolipin-mechanism"],
  notes: "Mechanistic primary study showing SS-31 interaction with lipid bilayers and membrane surface electrostatics, supporting cardiolipin-linked membrane effects."
};

const ss31Ant: Citation = {
  id: "doi-10-1007-s11357-023-00861-y",
  sourceType: "other",
  title: "The mitochondrially targeted peptide elamipretide (SS-31) improves ADP sensitivity in aged mitochondria by increasing uptake through the adenine nucleotide translocator (ANT)",
  authors: ["Gavin Pharaoh", "PubMed indexed authors"],
  year: 2023,
  doi: "10.1007/s11357-023-00861-y",
  url: "https://doi.org/10.1007/s11357-023-00861-y",
  accessedAt,
  quality: "primary",
  supportsClaimIds: ["ss31-ant-adp"],
  notes: "Mechanistic study reporting improved ADP sensitivity in aged mitochondria with evidence implicating the adenine nucleotide translocator."
};

const curated: Record<string, DeepPartial<PeptideRecord>> = {
  "tirzepatide": {
    names: { aliases: ["Mounjaro", "Zepbound", "LY3298176"], tradeNames: ["Mounjaro", "Zepbound"] },
    classification: { evidenceTier: "fda_phase3", regulatoryStatus: "fda_approved" },
    tile: {
      mechanismSummary: "Tirzepatide is a dual GLP-1/GIP receptor agonist approved in branded products for type 2 diabetes and chronic weight management contexts.",
      localization: "Pancreatic islets, CNS appetite circuits, gastrointestinal axis, adipose and metabolic tissues expressing incretin receptors.",
      enhancingEffects: [
        { label: "glycemic control", symbols: ["Rx", "H"], claimRef: "tirzepatide-fda-use" },
        { label: "weight reduction", symbols: ["Rx", "H"], claimRef: "tirzepatide-fda-use" },
        { label: "incretin receptor signaling", symbols: ["H", "R"], claimRef: "tirzepatide-mechanism" }
      ],
      sideEffects: ["FDA-described class context includes gastrointestinal adverse effects; exact rates must be imported from label.", "Compounded/non-branded products are not equivalent to FDA-reviewed products."],
      clinicalUses: ["FDA-approved branded tirzepatide products include diabetes and chronic weight-management contexts; exact indication must be label-specific."],
      dosing: {
        quick: "FDA context: Zepbound is administered subcutaneously once weekly with dose escalation to target maintenance doses described by FDA; this is label context, not advice.",
        adminRoute: "Subcutaneous once-weekly label context; exact label schedule to be imported before detailed display.",
        publicDisplayAllowed: true,
        context: "fda_label"
      }
    },
    biology: {
      genes: ["GLP1R", "GIPR", "INS", "GCG"],
      proteins: ["GLP-1 receptor", "GIP receptor", "insulin", "glucagon"],
      receptors: ["GLP-1R", "GIPR"],
      channelsTransporters: ["KATP channel physiology via glucose-stimulated insulin secretion"],
      cytokinesInterleukins: [{ name: "CRP", type: "inflammatory_marker", effect: "metabolic inflammation marker; peptide-specific source extraction pending", context: "human metabolic studies; needs field-level verification", symbols: ["H", "?"], claimRef: "tirzepatide-crp-pending" }],
      cascades: [
        { category: "pancreatic islet signaling", steps: ["Tirzepatide binds GLP-1R and GIPR on beta-cell signaling networks", "Gs -> adenylyl cyclase -> cAMP signaling increases", "PKA and EPAC2 activation amplifies glucose-dependent insulin-granule exocytosis", "alpha-cell glucagon secretion is restrained when glucose is elevated", "post-prandial glucose excursions and HbA1c fall in labeled clinical contexts"], symbols: ["Rx", "H"], claimRef: "tirzepatide-fda-use" },
        { category: "appetite and gastric-emptying signaling", steps: ["GLP-1R signaling increases in area postrema, NTS, and hypothalamic satiety circuits", "meal salience and hunger drive decrease", "gastric emptying slows most strongly early in treatment", "meal size and total energy intake decrease", "body weight falls in approved and trial populations"], symbols: ["Rx", "H"], claimRef: "tirzepatide-fda-use" },
        { category: "adipometabolic downstream effects", steps: ["sustained caloric intake reduction lowers total and visceral adiposity", "hepatic insulin sensitivity and peripheral glucose disposal can improve", "lipids, blood pressure, and inflammatory markers may improve secondarily", "marker-level direction remains study-specific rather than universal"], symbols: ["H", "R", "?"], claimRef: "tirzepatide-mechanism" }
      ]
    },
    expanded: {
      humanEvidence: "FDA-recognized branded products provide strong human regulatory evidence; trial-level outcomes should be imported from labels and pivotal publications.",
      mechanismDetail: "Mechanistically, tirzepatide is best understood as a dual incretin agonist rather than a generic weight-loss drug: GLP-1R/GIPR engagement drives cAMP, PKA, and EPAC signaling in islet cells, increasing glucose-dependent insulin secretion while limiting inappropriate glucagon release. In parallel, central GLP-1-linked satiety signaling and early gastric-emptying delay reduce caloric intake; body-weight and glycemic changes are downstream integrated physiological outcomes.",
      safetyDetail: "Display label-specific adverse events, contraindications, and boxed warnings only after label import. Common/nonclinical enhancement anecdotes must remain separate from label evidence.",
      safetyRisks: [
        {
          system: "gastrointestinal",
          label: "Gastrointestinal",
          color: "#fb7185",
          icon: "gut",
          helpSummary: null,
          harmSummary: "Regulatory and trial contexts consistently report gastrointestinal adverse effects as the dominant tolerability issue.",
          citationIds: ["fda-zepbound-2023"]
        },
        {
          system: "metabolic",
          label: "Metabolic / endocrine",
          color: "#6ee7b7",
          icon: "hexagon",
          helpSummary: "Approved-use contexts support glycemic control and weight-management benefits in indicated populations.",
          harmSummary: null,
          citationIds: ["fda-zepbound-2023"]
        }
      ],
      enhancementPotential: {
        summary: "Tirzepatide is clearly used by some healthy or less-diseased people for body-composition goals, but the strongest evidence base is still therapeutic/regulatory rather than enhancement-specific.",
        caveat: "Keep approved disease/obesity evidence separate from off-label physique or performance culture.",
        citationIds: ["fda-zepbound-2023"]
      },
      anecdotalUse: ["Common online enhancement/weight-loss discussion exists, but it should be labeled anecdotal/common-use unless tied to an approved indication or published study."]
    },
    claims: [
      claim("tirzepatide-fda-use", "tile.clinicalUses", "FDA-approved branded tirzepatide products include diabetes and chronic weight management contexts.", ["Rx", "H"], ["fda-zepbound-2023"], "fda_label", "human", 0.9),
      claim("tirzepatide-mechanism", "tile.mechanismSummary", "dual GLP-1/GIP receptor agonist", ["H", "R"], ["fda-zepbound-2023"], "review", "human", 0.7)
    ],
    citations: [fdaTirzepatide, source("peptpedia"), source("peptidePartnersShop")],
    moderation: { status: "needs_review" }
  },
  "liraglutide": {
    names: { aliases: ["Victoza", "Saxenda"], tradeNames: ["Victoza", "Saxenda"] },
    classification: { evidenceTier: "fda_phase3", regulatoryStatus: "fda_approved" },
    tile: {
      mechanismSummary: "Liraglutide is an FDA-approved GLP-1 receptor agonist used in branded products for type 2 diabetes and weight-management contexts.",
      localization: "GLP-1 receptor signaling in pancreatic islets, gastrointestinal axis, and central appetite circuits.",
      enhancingEffects: [
        { label: "glycemic control", symbols: ["Rx", "H"], claimRef: "liraglutide-fda-use" },
        { label: "weight management context", symbols: ["Rx", "H"], claimRef: "liraglutide-weight-context" },
        { label: "GLP-1 receptor activation", symbols: ["H", "R"], claimRef: "liraglutide-fda-use" }
      ],
      sideEffects: ["Label-specific GI adverse events and thyroid C-cell warning context must be imported from current label.", "Generic/brand availability can change and requires regulatory refresh."],
      clinicalUses: ["FDA page describes Victoza as adjunct to diet and exercise for glycemic control in adults with type 2 diabetes."],
      dosing: {
        quick: "FDA/label context only; exact product-specific dose wording must come from the current label.",
        adminRoute: "Subcutaneous product-label context; not an enhancement protocol.",
        publicDisplayAllowed: true,
        context: "fda_label"
      }
    },
    biology: {
      genes: ["GLP1R", "INS", "GCG", "POMC"],
      proteins: ["GLP-1 receptor", "insulin", "glucagon", "POMC"],
      receptors: ["GLP-1R"],
      channelsTransporters: ["KATP channel physiology via glucose-stimulated insulin secretion"],
      cytokinesInterleukins: [{ name: "CRP", type: "inflammatory_marker", effect: "metabolic inflammation marker; source-specific extraction pending", context: "human metabolic studies; needs field-level verification", symbols: ["H", "?"], claimRef: "liraglutide-crp-pending" }],
      cascades: [
        { category: "islet incretin signaling", steps: ["Liraglutide agonizes GLP-1R", "Gs signaling increases cAMP", "glucose-dependent insulin release increases", "inappropriate glucagon signaling decreases", "glycemic control improves in labeled contexts"], symbols: ["Rx", "H"], claimRef: "liraglutide-fda-use" },
        { category: "CNS and GI signaling", steps: ["GLP-1R signaling increases in satiety circuits", "appetite decreases", "gastric emptying slows", "meal size and energy intake decrease", "weight-loss effects can emerge in weight-management contexts"], symbols: ["Rx", "H"], claimRef: "liraglutide-fda-use" }
      ]
    },
    expanded: {
      mechanismDetail: "Traceable draft cascade: liraglutide activates GLP-1R, increases cAMP signaling, increases glucose-dependent insulin secretion, decreases glucagon signaling, and reduces appetite partly through central satiety pathways and delayed gastric emptying."
    },
    claims: [claim("liraglutide-fda-use", "tile.clinicalUses", "Victoza is FDA-approved as adjunct to diet and exercise to improve glycemic control in adults with type 2 diabetes.", ["Rx", "H"], ["fda-liraglutide-victoza"], "fda_label", "human", 0.9)],
    citations: [fdaLiraglutide, source("peptpedia")],
    moderation: { status: "needs_review" }
  },
  "semaglutide": {
    names: { aliases: ["Ozempic", "Wegovy", "Rybelsus"], tradeNames: ["Ozempic", "Wegovy", "Rybelsus"] },
    classification: { evidenceTier: "fda_phase3", regulatoryStatus: "fda_approved" },
    tile: {
      mechanismSummary: "Semaglutide is a long-acting GLP-1 receptor agonist draft-linked to glucose-dependent insulin secretion, appetite suppression, and delayed gastric emptying.",
      localization: "Pancreatic islets, hypothalamic/brainstem appetite circuits, gastrointestinal axis, and downstream adipometabolic tissues.",
      enhancingEffects: [
        { label: "GLP-1 receptor agonism", symbols: ["R", "?"], claimRef: "semaglutide-mechanism-draft" },
        { label: "appetite reduction", symbols: ["R", "?"], claimRef: "semaglutide-mechanism-draft" },
        { label: "glycemic control context", symbols: ["R", "?"], claimRef: "semaglutide-mechanism-draft" }
      ],
      clinicalUses: ["Human therapeutic contexts are well known, but exact label/trial wording should be tied to imported primary or regulatory citations before being treated as definitive."],
      dosing: {
        quick: "Clinical and labeled human-use context exists, but exact dose wording should be refreshed from current product labels or trials.",
        adminRoute: "Subcutaneous and oral branded-product contexts exist; keep display citation-specific.",
        publicDisplayAllowed: true,
        context: "review"
      }
    },
    biology: {
      genes: ["GLP1R", "INS", "GCG", "POMC"],
      proteins: ["GLP-1 receptor", "insulin", "glucagon", "POMC neuron signaling"],
      receptors: ["GLP-1R"],
      channelsTransporters: ["KATP-linked beta-cell stimulus-secretion physiology"],
      cascades: [
        { category: "islet incretin signaling", steps: ["Semaglutide binds GLP-1R on beta-cell signaling machinery", "Gs -> adenylyl cyclase -> cAMP increases", "PKA / EPAC2 signaling amplifies glucose-dependent insulin exocytosis", "alpha-cell glucagon output falls under hyperglycemic conditions", "fasting and post-prandial glycemia improve in therapeutic settings"], symbols: ["R", "?"], claimRef: "semaglutide-mechanism-draft" },
        { category: "satiety and GI signaling", steps: ["central GLP-1R signaling increases in appetite-regulating brainstem and hypothalamic circuits", "satiety increases and food-reward drive falls", "gastric emptying slows especially early in treatment", "meal size and total caloric intake decrease", "weight-loss effects follow in human therapeutic contexts"], symbols: ["R", "?"], claimRef: "semaglutide-mechanism-draft" }
      ]
    },
    expanded: {
      mechanismDetail: "Mechanistically, semaglutide fits the classic GLP-1 receptor cascade: receptor binding increases cAMP in islet cells, strengthens glucose-dependent insulin secretion, dampens glucagon output in hyperglycemia, and engages central satiety pathways while slowing gastric emptying. The clinical weight-loss phenotype is a downstream systems effect of reduced intake plus improved metabolic control, not a separate receptor pathway.",
      safetyRisks: [
        {
          system: "gastrointestinal",
          label: "Gastrointestinal",
          color: "#fb7185",
          icon: "gut",
          helpSummary: null,
          harmSummary: "Human therapeutic programs consistently describe gastrointestinal adverse effects as the dominant class toxicity context.",
          citationIds: ["src-peptpedia-browse"]
        }
      ],
      enhancementPotential: {
        summary: "Semaglutide is widely sought for appetite suppression and body-weight reduction, but that social use should not be confused with enhancement evidence in healthy physiology.",
        caveat: "Replace with label- and trial-specific wording once the next regulatory batch is imported.",
        citationIds: ["src-peptpedia-browse"]
      },
      anecdotalUse: ["Common nonclinical discussion focuses on appetite suppression and body-composition goals, but this must remain separated from citation-backed therapeutic evidence."]
    },
    claims: [claim("semaglutide-mechanism-draft", "tile.mechanismSummary", "Long-acting GLP-1 receptor agonist with satiety, gastric-emptying, and glucose-dependent insulin-secretion effects.", ["R", "?"], [source("peptpedia").id], "review", "mixed", 0.5)]
  },
  "retatrutide": {
    classification: { evidenceTier: "human_clinical_development", regulatoryStatus: "investigational" },
    tile: {
      mechanismSummary: "Retatrutide is a draft-tracked triple agonist spanning GLP-1R, GIPR, and glucagon receptor signaling with downstream appetite, glucose, and energy-expenditure implications.",
      localization: "Pancreatic islets, CNS appetite circuits, liver, adipose tissue, and peripheral metabolic tissues influenced by incretin and glucagon signaling.",
      enhancingEffects: [
        { label: "triple incretin/glucagon signaling", symbols: ["R", "?"], claimRef: "retatrutide-mechanism-draft" },
        { label: "appetite reduction", symbols: ["R", "?"], claimRef: "retatrutide-mechanism-draft" },
        { label: "energy expenditure / lipolysis context", symbols: ["R", "?"], claimRef: "retatrutide-mechanism-draft" }
      ]
    },
    biology: {
      genes: ["GLP1R", "GIPR", "GCGR", "INS", "GCG"],
      proteins: ["GLP-1 receptor", "GIP receptor", "glucagon receptor", "insulin", "glucagon"],
      receptors: ["GLP-1R", "GIPR", "GCGR"],
      channelsTransporters: ["beta-cell KATP-linked stimulus-secretion physiology"],
      cascades: [
        { category: "tri-agonist metabolic signaling", steps: ["Retatrutide binds GLP-1R, GIPR, and GCGR across islet, CNS, hepatic, and adipometabolic tissues", "cAMP signaling increases in multiple receptor compartments", "glucose-dependent insulin secretion rises while glucagon biology is shifted by combined incretin and glucagon-receptor tone", "hepatic glucose and lipid handling changes in a context-dependent way", "glycemic control improves in development programs"], symbols: ["R", "?"], claimRef: "retatrutide-mechanism-draft" },
        { category: "appetite, expenditure, and adiposity signaling", steps: ["central GLP-1-linked satiety signaling increases", "food intake decreases", "glucagon-receptor signaling may increase energy expenditure and lipolytic flux", "body weight and adiposity can fall more than with dual-agonist programs", "specific component attribution still requires trial-level mechanistic parsing"], symbols: ["R", "?"], claimRef: "retatrutide-mechanism-draft" }
      ]
    },
    expanded: {
      mechanismDetail: "Retatrutide should be read as a distributed metabolic program: GLP-1R and GIPR signaling support incretin-mediated glycemic control, while GCGR engagement adds a distinct hepatic and energy-expenditure axis. The resulting phenotype is a composite of lower intake, altered nutrient partitioning, and glucagon-linked energy handling rather than a simple appetite-only mechanism.",
      safetyRisks: [
        {
          system: "gastrointestinal",
          label: "Gastrointestinal",
          color: "#fb7185",
          icon: "gut",
          helpSummary: null,
          harmSummary: "Human-development summaries consistently flag gastrointestinal adverse effects as the main tolerability burden.",
          citationIds: ["src-peptpedia-browse"]
        }
      ],
      enhancementPotential: {
        summary: "Because retatrutide has aggressive weight-loss signals in development, it will predictably attract enhancement/body-composition interest before formal approval.",
        caveat: "Current framing should remain developmental, not healthy-human performance evidence.",
        citationIds: ["src-peptpedia-browse"]
      }
    },
    claims: [claim("retatrutide-mechanism-draft", "tile.mechanismSummary", "Triple GLP-1/GIP/glucagon receptor agonist with multi-axis metabolic signaling.", ["R", "?"], [source("peptpedia").id], "review", "mixed", 0.48)]
  },
  "cagrilintide": {
    tile: {
      mechanismSummary: "Cagrilintide is an amylin-analog draft linked to satiety signaling, reduced gastric-emptying drive, and lower caloric intake.",
      localization: "Area postrema/nucleus tractus solitarius satiety circuits, pancreatic-amylin signaling space, and gastrointestinal control pathways.",
      enhancingEffects: [
        { label: "amylin receptor satiety signaling", symbols: ["R", "?"], claimRef: "cagrilintide-mechanism-draft" },
        { label: "reduced caloric intake", symbols: ["R", "?"], claimRef: "cagrilintide-mechanism-draft" }
      ]
    },
    biology: {
      genes: ["CALCR", "RAMP1", "RAMP3"],
      proteins: ["calcitonin receptor", "RAMP complexes", "amylin signaling"],
      receptors: ["amylin receptor complex"],
      channelsTransporters: [],
      cascades: [
        { category: "satiety signaling", steps: ["Cagrilintide activates amylin-receptor complexes", "post-meal satiety signaling increases", "gastric emptying slows", "meal size decreases", "weight-management effects may follow when paired with other therapies"], symbols: ["R", "?"], claimRef: "cagrilintide-mechanism-draft" }
      ]
    },
    claims: [claim("cagrilintide-mechanism-draft", "tile.mechanismSummary", "Long-acting amylin analog that increases satiety signaling and reduces energy intake.", ["R", "?"], [source("peptpedia").id], "review", "mixed", 0.46)]
  },
  "mots-c": {
    classification: { evidenceTier: "preclinical", regulatoryStatus: "not_approved" },
    tile: {
      mechanismSummary: "MOTS-c is a mitochondrial-derived peptide with primary preclinical evidence for AMPK-linked metabolic stress signaling, direct CK2 engagement in muscle, and antioxidant-response modulation.",
      localization: "Skeletal muscle, adipose tissue, mitochondrial stress-response networks, and stress-responsive nuclear signaling contexts.",
      enhancingEffects: [
        { label: "metabolic homeostasis signaling", symbols: ["A", "C"], claimRef: "motsc-ampk-folate" },
        { label: "exercise / muscle-performance discussion", symbols: ["A", "?"], claimRef: "motsc-ck2-target" },
        { label: "healthy-human enhancement claims", symbols: ["N", "?"], claimRef: "motsc-enhancement-unknown" }
      ],
      sideEffects: ["No robust peer-reviewed human safety trial is imported for MOTS-c.", "Healthy-human enhancement use remains unverified and should not be treated as established physiology data."],
      clinicalUses: ["No approved clinical use is verified in the current source set."],
      dosing: {
        quick: "Preclinical dosing exists in mice and cell systems, but no verified public human dosing context is imported.",
        adminRoute: "Animal i.p. and cell-study contexts are not human-use guidance.",
        publicDisplayAllowed: false,
        context: "preclinical"
      }
    },
    biology: {
      genes: ["MT-RNR1", "PRKAA1", "PRKAA2", "SIRT1", "PPARGC1A", "CSNK2A1", "NFE2L2", "HMOX1", "NQO1"],
      proteins: ["MOTS-c", "AMPK", "SIRT1", "PGC-1alpha", "CK2", "Nrf2", "HO-1", "NQO1", "NF-kB p65"],
      receptors: [],
      channelsTransporters: [],
      cytokinesInterleukins: [],
      cascades: [
        { category: "metabolic stress signaling", steps: ["MOTS-c is encoded within the mitochondrial 12S rRNA region", "folate-cycle / de novo purine synthesis stress is induced in primary work", "AICAR-like metabolic stress signaling accumulates", "AMPK activation increases", "skeletal-muscle glucose disposal and fatty-acid handling shift toward improved metabolic homeostasis"], symbols: ["A", "C"], claimRef: "motsc-ampk-folate" },
        { category: "adiponectin-mitochondrial biogenesis axis", steps: ["adiponectin receptor signaling engages APPL1", "SIRT1 activity increases", "PGC-1alpha-linked mitochondrial biogenesis programs increase", "MOTS-c expression / secretion in skeletal muscle increases", "insulin-resistance phenotypes improve in mouse and myotube systems"], symbols: ["A", "C"], claimRef: "motsc-appl1-axis" },
        { category: "direct muscle target and redox signaling", steps: ["MOTS-c directly binds CK2 in primary 2024 skeletal-muscle work", "CK2 kinase activity increases", "myofiber glucose uptake and resistance to disuse-atrophy programs improve", "Nrf2/ARE antioxidant-response genes can increase", "NF-kB inflammatory signaling can decrease under oxidative stress"], symbols: ["A", "C"], claimRef: "motsc-ck2-target" }
      ]
    },
    expanded: {
      humanEvidence: "No peer-reviewed human interventional trial demonstrating efficacy or safety is imported here. The current usable record is preclinical and mechanistic.",
      animalEvidence: "Primary mouse studies report improved insulin-resistance, obesity, adipose dysfunction, and muscle-function endpoints under experimental conditions, with no basis to infer healthy-human enhancement.",
      mechanismDetail: "The currently strongest MOTS-c pathway is: mitochondrial-encoded peptide generation -> folate/purine metabolic stress sensing -> AMPK activation -> downstream metabolic adaptation in muscle. Later primary papers add an adiponectin-APPL1-SIRT1-PGC-1alpha axis and direct CK2 binding in skeletal muscle, while oxidative-stress models show Nrf2/ARE activation with relative NF-kB suppression.",
      safetyDetail: "Human safety evidence is missing. The site should present MOTS-c as a preclinical metabolic-signaling peptide rather than a verified human therapy or enhancement tool.",
      safetyRisks: [
        {
          system: "metabolic",
          label: "Metabolic / endocrine",
          color: "#6ee7b7",
          icon: "hexagon",
          helpSummary: "Mouse studies reported improved insulin resistance, adipose homeostasis, and muscle glucose handling under experimental conditions.",
          harmSummary: null,
          citationIds: ["pmid-25738459", "pmid-32880686", "pmid-39559755"]
        }
      ],
      enhancementPotential: {
        summary: "Online discussion frames MOTS-c as an exercise or metabolic enhancer, but the imported evidence for that framing is preclinical rather than healthy-human clinical.",
        caveat: "Do not translate mouse/metabolic-stress findings into human enhancement claims without human trial data.",
        citationIds: ["pmid-39559755", "pmid-25738459"]
      },
      anecdotalUse: ["Exercise-mimetic and metabolic-enhancement claims circulate publicly, but the current source base does not establish healthy-human efficacy."],
      missingEvidence: ["human trials", "human adverse events", "public human PK/PD", "receptor-level human confirmation"]
    },
    claims: [
      claim("motsc-ampk-folate", "tile.mechanismSummary", "Primary preclinical MOTS-c work linked the peptide to folate-cycle / purine-stress signaling and AMPK activation with improved metabolic homeostasis in mice.", ["A", "C"], ["pmid-25738459"], "preclinical", "mixed", 0.8),
      claim("motsc-appl1-axis", "biology.proteins", "Adiponectin signaling regulated MOTS-c through an APPL1-SIRT1-PGC-1alpha axis in mouse and myotube systems.", ["A", "C"], ["pmid-32880686"], "preclinical", "mixed", 0.72),
      claim("motsc-ck2-target", "biology.proteins", "Primary 2024 work identified CK2 as a direct MOTS-c binding target in skeletal muscle contexts.", ["A", "C"], ["pmid-39559755"], "preclinical", "mixed", 0.8),
      claim("motsc-nrf2-nfkb", "biology.proteins", "Cell work reported MOTS-c activation of Nrf2/ARE signaling with suppression of NF-kB-p65 phosphorylation under oxidative stress.", ["C"], ["pmid-34859377"], "cell", "cell", 0.7),
      claim("motsc-enhancement-unknown", "expanded.enhancementPotential", "Healthy-human enhancement remains unverified in the current imported record.", ["N", "?"], ["pmid-25738459"], "anecdotal_common_use", "unknown", 0.3)
    ],
    citations: [motsCellMetab, motsAppl1, motsCk2, motsNrf2, source("peptpedia")],
    moderation: { status: "needs_review" }
  },
  "bpc-157": {
    classification: { evidenceTier: "preclinical", regulatoryStatus: "not_approved" },
    tile: {
      mechanismSummary: "BPC-157 is a non-approved peptide with primary preclinical papers pointing to angiogenic, ERK/MAPK, nitric-oxide, and microvascular-repair signaling; robust human therapeutic evidence remains absent.",
      localization: "Gastrointestinal mucosa, endothelium, fibroblast/wound-healing compartments, tendon/ligament injury models, and local repair microenvironments.",
      enhancingEffects: [
        { label: "angiogenic repair signaling", symbols: ["A"], claimRef: "bpc157-vegf-erk" },
        { label: "tendon/ligament healing claims", symbols: ["A"], claimRef: "bpc157-tendon-angiogenesis" },
        { label: "gut mucosal protection claims", symbols: ["A"], claimRef: "bpc157-no-vegfr1" },
        { label: "sports-recovery / enhancement discussion", symbols: ["N", "?"], claimRef: "bpc157-enhancement-unknown" }
      ],
      sideEffects: ["No robust peer-reviewed controlled human safety trial is imported.", "Publicly sold BPC-157 products should not be treated as validated medical-grade equivalents."],
      clinicalUses: ["No FDA-approved or well-supported peer-reviewed human therapeutic use is imported in this record."],
      dosing: {
        quick: "Human dosing is not established here; only animal and cell-system protocols are source-backed.",
        adminRoute: "Topical, intraperitoneal, and local preclinical routes are not human-use advice.",
        publicDisplayAllowed: false,
        context: "preclinical"
      }
    },
    biology: {
      genes: ["VEGFA", "FLT1", "KDR", "NOS3", "PTGS2", "MAPK1", "MAPK3"],
      proteins: ["VEGF-A", "VEGFR1", "VEGFR2", "eNOS", "COX-2", "ERK1/2", "c-Fos", "c-Jun", "Egr-1"],
      receptors: ["VEGFR1", "VEGFR2"],
      channelsTransporters: ["NO-dependent vascular tone signaling"],
      cytokinesInterleukins: [],
      cascades: [
        { category: "angiogenesis and endothelial migration", steps: ["BPC-157 increases VEGF-A expression in primary alkali-burn work", "ERK1/2 phosphorylation rises with downstream c-Fos / c-Jun / Egr-1 transcriptional signaling", "HUVEC proliferation, migration, and tube formation increase", "granulation tissue, re-epithelialization, and collagen deposition improve in rats"], symbols: ["A", "C"], claimRef: "bpc157-vegf-erk" },
        { category: "microvascular and nitric-oxide signaling", steps: ["BPC-157 preserves eNOS-linked nitric-oxide biology in injury models", "VEGF-A / VEGFR1 / AKT / p38-MAPK signaling is modulated in gastric injury", "microcirculatory integrity and mucosal resistance improve", "translation to human efficacy remains unverified"], symbols: ["A"], claimRef: "bpc157-no-vegfr1" },
        { category: "musculoskeletal repair signaling", steps: ["tendon and muscle-healing models show altered angiogenesis-marker expression", "VEGF / CD34 / factor VIII-associated repair signals change with healing", "myotendinous-junction injury models show eNOS and COX-2 mRNA effects with oxidative-stress counteraction", "the signal remains preclinical rather than clinically validated human regenerative medicine"], symbols: ["A"], claimRef: "bpc157-eNOS-cox2" }
      ]
    },
    expanded: {
      humanEvidence: "Peer-reviewed controlled human efficacy evidence is still not imported here. The record remains preclinical-heavy.",
      animalEvidence: "Primary rat and cell studies support wound-healing, angiogenesis, gastric-mucosal protection, and tendon/myotendinous repair readouts under experimental conditions.",
      mechanismDetail: "The mechanistic chain now shown is: BPC-157 -> VEGF-linked endothelial signaling -> ERK1/2 and immediate-early transcription factors -> angiogenesis / migration / repair. Separate injury models add VEGFR1/AKT/p38-MAPK and eNOS/COX-2 nitric-oxide-system effects. That is a real preclinical pathway story, but still not a validated human therapeutic cascade.",
      safetyDetail: "The main present limitation is absence of strong human safety and efficacy evidence, not evidence of proven safety. Preclinical benefit claims should not be translated into human repair or enhancement claims without human trials.",
      safetyRisks: [
        {
          system: "gastrointestinal",
          label: "Gastrointestinal",
          color: "#4ade80",
          icon: "capsule",
          helpSummary: "Rat gastric-injury models reported mucosal protection with VEGF-A / VEGFR1 / AKT / p38-MAPK and eNOS-linked signaling changes.",
          harmSummary: null,
          citationIds: ["pmid-33376304"]
        },
        {
          system: "musculoskeletal",
          label: "Musculoskeletal",
          color: "#c4b5fd",
          icon: "joint",
          helpSummary: "Rat tendon and myotendinous-junction studies reported improved repair readouts with angiogenic and nitric-oxide-system changes.",
          harmSummary: null,
          citationIds: ["pmid-20388964", "pmid-34829776"]
        }
      ],
      enhancementPotential: {
        summary: "BPC-157 is widely discussed as a recovery enhancer, but the support imported here is animal/cell injury biology rather than healthy-human performance data.",
        caveat: "Keep enhancement discussion clearly separated from medical evidence; robust human trial data are missing.",
        citationIds: ["pmid-25995620", "pmid-20388964"]
      },
      anecdotalUse: ["Sports-recovery, GI-protection, and soft-tissue-healing claims are common online, but strong human efficacy evidence is not established."],
      missingEvidence: ["controlled human trials", "human adverse events", "human PK/PD", "regulatory approval"]
    },
    claims: [
      claim("bpc157-vegf-erk", "tile.mechanismSummary", "Primary alkali-burn work linked BPC-157 to increased VEGF-A expression, endothelial migration/tube formation, and ERK1/2-c-Fos-c-Jun-Egr-1 signaling.", ["A", "C"], ["pmid-25995620"], "preclinical", "mixed", 0.8),
      claim("bpc157-tendon-angiogenesis", "biology.proteins", "Muscle/tendon-healing work reported modulated angiogenesis markers during BPC-157-assisted repair.", ["A"], ["pmid-20388964"], "preclinical", "animal", 0.68),
      claim("bpc157-no-vegfr1", "biology.proteins", "Rat gastric-injury work linked BPC-157 to VEGF-A / VEGFR1 / AKT / p38-MAPK signaling with eNOS-related protection.", ["A"], ["pmid-33376304"], "preclinical", "animal", 0.76),
      claim("bpc157-eNOS-cox2", "biology.proteins", "Myotendinous-junction work reported BPC-157 effects on eNOS and COX-2 mRNA with oxidative-stress/NO-system changes.", ["A"], ["pmid-34829776"], "preclinical", "animal", 0.72),
      claim("bpc157-enhancement-unknown", "expanded.enhancementPotential", "Healthy-human enhancement remains unverified in the imported source set.", ["N", "?"], ["pmid-25995620"], "anecdotal_common_use", "unknown", 0.3)
    ],
    citations: [bpcBurn, bpcAngiogenesis, bpcClopidogrel, bpcMyotendinous, source("peptpedia"), source("peptidePartnersShop")],
    moderation: { status: "needs_review" }
  },
  "ghk-cu": {
    classification: { evidenceTier: "preclinical", regulatoryStatus: "not_approved" },
    tile: {
      mechanismSummary: "GHK-Cu is a copper-binding tripeptide with primary preclinical support for matrix-remodeling, keratinocyte/fibroblast repair phenotypes, and anti-inflammatory anti-fibrotic signaling.",
      localization: "Dermis, extracellular matrix, fibroblasts, wound bed, hair follicle environment, and oxidative-stress response compartments.",
      enhancingEffects: [
        { label: "collagen / matrix remodeling", symbols: ["A", "C"], claimRef: "ghkcu-integrin-epithelium" },
        { label: "anti-fibrotic signaling", symbols: ["A"], claimRef: "ghkcu-nrf2-smad" },
        { label: "cosmetic skin-quality claims", symbols: ["N", "?"], claimRef: "ghkcu-enhancement-unknown" }
      ],
      sideEffects: ["Human systemic safety evidence is not established in this record.", "Cosmetic/topical marketing language should not be read as human regenerative proof."],
      clinicalUses: ["No approved human systemic therapeutic indication is verified in the current source set."],
      dosing: {
        quick: "Topical, animal, and local experimental contexts exist; no verified human systemic dosing context is imported here.",
        adminRoute: "Preclinical and cosmetic-context routes are not clinical guidance.",
        publicDisplayAllowed: false,
        context: "preclinical"
      }
    },
    biology: {
      genes: ["ITGA6", "ITGB1", "TP63", "MMP9", "TIMP1", "NFE2L2", "NFKB1", "TGFB1", "IL6", "TNF"],
      proteins: ["integrins", "p63", "MMP-9", "TIMP-1", "Nrf2", "NF-kB p65", "TGF-beta1", "Smad2/3", "IL-6", "TNF-alpha"],
      receptors: [],
      channelsTransporters: ["copper trafficking context"],
      cytokinesInterleukins: [
        { name: "IL-6", type: "interleukin", effect: "decreased in bleomycin pulmonary-fibrosis mouse model", context: "mouse lung fibrosis", symbols: ["A"], claimRef: "ghkcu-nrf2-smad" },
        { name: "TNF-alpha", type: "cytokine", effect: "decreased in bleomycin pulmonary-fibrosis mouse model", context: "mouse lung fibrosis", symbols: ["A"], claimRef: "ghkcu-nrf2-smad" }
      ],
      cascades: [
        { category: "epithelial / matrix repair", steps: ["Copper-GHK increases keratinocyte integrin expression", "p63-positive reparative epithelial phenotype increases", "adhesion and migration competence increase", "matrix-remodeling / wound-closure programs become more repair-biased locally"], symbols: ["C"], claimRef: "ghkcu-integrin-epithelium" },
        { category: "anti-fibrotic inflammatory signaling", steps: ["GHK-Cu lowers TNF-alpha and IL-6 in bleomycin fibrosis models", "NF-kB inflammatory signaling decreases", "Nrf2 antioxidant-response signaling increases", "TGF-beta1 / Smad2/3 profibrotic signaling decreases", "MMP-9 / TIMP-1 balance partially normalizes as EMT and fibrosis decline"], symbols: ["A"], claimRef: "ghkcu-nrf2-smad" }
      ]
    },
    expanded: {
      humanEvidence: "No robust peer-reviewed human therapeutic trial is imported here; the usable evidence base is preclinical and topical/cosmetic-adjacent.",
      animalEvidence: "Primary animal work supports anti-inflammatory and anti-fibrotic lung effects, while cell studies support reparative epithelial phenotypes.",
      mechanismDetail: "The strongest imported GHK-Cu chain is: copper-bound tripeptide signaling -> reparative epithelial / matrix bias plus anti-inflammatory anti-fibrotic signaling. Specific primary findings include increased keratinocyte integrin/p63 expression and, in pulmonary-fibrosis mice, lower TNF-alpha and IL-6 with effects on Nrf2, NF-kB, TGF-beta1/Smad2/3, and MMP-9/TIMP-1 balance.",
      safetyDetail: "Human systemic safety and efficacy remain unclear. The current record should be read as preclinical wound/fibrosis biology, not as established human regenerative medicine.",
      safetyRisks: [
        {
          system: "pulmonary",
          label: "Pulmonary",
          color: "#7dd3fc",
          icon: "lung",
          helpSummary: "Mouse pulmonary-fibrosis work reported less inflammation, collagen deposition, EMT signaling, and better cytokine profile.",
          harmSummary: null,
          citationIds: ["pmid-31809714"]
        },
        {
          system: "dermatologic",
          label: "Dermatologic",
          color: "#f9a8d4",
          icon: "skin",
          helpSummary: "Keratinocyte work reported increased integrin expression and p63 positivity, consistent with a reparative epithelial phenotype.",
          harmSummary: null,
          citationIds: ["pmid-19319546"]
        }
      ],
      enhancementPotential: {
        summary: "GHK-Cu is often framed cosmetically for skin quality or hair support, but the imported support remains mechanistic/preclinical rather than strong human enhancement evidence.",
        caveat: "Keep cosmetic/topical discussion distinct from claims of systemic regeneration.",
        citationIds: ["pmid-19319546", "pmid-31809714"]
      },
      anecdotalUse: ["Cosmetic, skin-quality, and hair-focused claims are common, but strong human efficacy evidence is limited in the current import."],
      missingEvidence: ["controlled human trials", "human adverse events", "human systemic PK/PD", "approved indication"]
    },
    claims: [
      claim("ghkcu-integrin-epithelium", "biology.proteins", "Copper-GHK increased keratinocyte integrin expression and p63 positivity in a primary epithelial repair study.", ["C"], ["pmid-19319546"], "cell", "cell", 0.72),
      claim("ghkcu-nrf2-smad", "biology.cytokinesInterleukins", "In bleomycin pulmonary fibrosis, GHK-Cu lowered TNF-alpha and IL-6 and modulated Nrf2 / NF-kB / TGF-beta1-Smad2/3 signaling.", ["A"], ["pmid-31809714"], "preclinical", "animal", 0.8),
      claim("ghkcu-enhancement-unknown", "expanded.enhancementPotential", "Human enhancement/cosmetic efficacy remains incompletely established in the imported source set.", ["N", "?"], ["pmid-19319546"], "anecdotal_common_use", "unknown", 0.3)
    ],
    citations: [ghkPulmonaryFibrosis, ghkKeratinocyte, source("peptpedia"), source("peptidePartnersShop")],
    moderation: { status: "needs_review" }
  },
  "tb-500": {
    classification: { evidenceTier: "preclinical", regulatoryStatus: "not_approved" },
    tile: {
      mechanismSummary: "TB-500 is best treated as a thymosin-beta-4-related preclinical hypothesis: the sturdier source base is thymosin beta-4 literature on actin handling, MMP remodeling, angiogenesis, and inflammatory modulation rather than direct human TB-500 trials.",
      localization: "Cytoskeletal/migratory repair compartments including endothelial cells, fibroblasts, muscle, tendon, and wound-healing tissues.",
      enhancingEffects: [
        { label: "cell migration and repair", symbols: ["A", "C"], claimRef: "tb500-tb4-mmp-remodeling" },
        { label: "angiogenesis context", symbols: ["A", "C"], claimRef: "tb500-tb4-vegf-akt" },
        { label: "sports-recovery anecdote", symbols: ["N", "?"], claimRef: "tb500-enhancement-unknown" }
      ],
      sideEffects: ["Direct human TB-500 safety data are not established here.", "Thymosin beta-4-related biology should not be overread as direct proof for TB-500 fragment use in people."],
      clinicalUses: ["No verified approved human clinical use for TB-500 is imported in this record."],
      dosing: {
        quick: "Direct human TB-500 dosing is not verified here; imported evidence is preclinical and mostly thymosin beta-4-related.",
        adminRoute: "Preclinical/experimental contexts only.",
        publicDisplayAllowed: false,
        context: "preclinical"
      }
    },
    biology: {
      genes: ["TMSB4X", "ACTB", "MMP1", "MMP2", "MMP9", "VEGFA", "AKT1", "RELA", "CXCL8", "TGFB1"],
      proteins: ["thymosin beta-4", "G-actin", "MMP-1", "MMP-2", "MMP-9", "VEGF-A", "AKT", "NF-kB RelA/p65", "IL-8"],
      receptors: [],
      channelsTransporters: [],
      cytokinesInterleukins: [{ name: "IL-8", type: "chemokine", effect: "decreased via reduced NF-kB activation in thymosin beta-4 cell study", context: "TNF-alpha-stimulated epithelial-cell system", symbols: ["C"], claimRef: "tb500-tb4-nfkb-il8" }],
      cascades: [
        { category: "actin and matrix remodeling", steps: ["thymosin beta-4 binds and sequesters G-actin monomers", "motile-cell cytoskeletal reorganization increases", "MMP-1 / MMP-2 / MMP-9 expression increases in wound-repair cells", "extracellular-matrix remodeling and cell migration accelerate", "repair readouts improve in preclinical systems"], symbols: ["A", "C"], claimRef: "tb500-tb4-mmp-remodeling" },
        { category: "angiogenesis signaling", steps: ["thymosin beta-4 increases endothelial migration and proliferation", "VEGF / AKT pathway signaling increases in diabetic-wound models", "vascularization and perfusion increase", "re-epithelialization and wound architecture improve", "direct human TB-500 efficacy remains unverified"], symbols: ["A", "C"], claimRef: "tb500-tb4-vegf-akt" },
        { category: "inflammatory modulation", steps: ["TNF-alpha drives NF-kB RelA/p65 activation in cell models", "thymosin beta-4 reduces RelA/p65 nuclear signaling", "IL-8 transcription decreases", "inflammatory sensitization decreases", "fragment-to-human extrapolation remains limited"], symbols: ["C"], claimRef: "tb500-tb4-nfkb-il8" }
      ]
    },
    expanded: {
      humanEvidence: "No direct peer-reviewed human TB-500 efficacy trial is imported here.",
      animalEvidence: "The usable mechanistic base is thymosin beta-4 preclinical literature on wound healing, angiogenesis, MMP remodeling, and inflammatory signaling.",
      mechanismDetail: "The honest way to present TB-500 is: direct evidence is sparse, but thymosin beta-4 primary literature consistently shows G-actin sequestration, migration/MMP remodeling, VEGF/AKT-linked angiogenesis, and NF-kB/IL-8 inflammatory modulation. Those pathways are mechanistically relevant to TB-500 discussions but still are not equivalent to direct human TB-500 validation.",
      safetyDetail: "Human TB-500 safety and efficacy remain poorly defined in the imported record. Public sports-recovery use should be kept in anecdotal/nonclinical territory.",
      safetyRisks: [
        {
          system: "dermatologic",
          label: "Dermatologic / wound",
          color: "#f9a8d4",
          icon: "skin",
          helpSummary: "Thymosin beta-4 wound models reported faster re-epithelialization, higher vascularization, and greater matrix remodeling.",
          harmSummary: null,
          citationIds: ["pmid-16607611", "pmid-25204972"]
        }
      ],
      enhancementPotential: {
        summary: "TB-500 is heavily discussed for recovery and tissue repair, but the imported source base is preclinical and mostly thymosin beta-4-related rather than direct healthy-human evidence.",
        caveat: "Present as mechanistic/preclinical context, not as validated sports medicine.",
        citationIds: ["pmid-16607611", "pmid-25204972", "pmid-21343177"]
      },
      anecdotalUse: ["Sports-recovery and injury-healing claims are common in public discussion, but direct human evidence remains limited and uncertain."],
      missingEvidence: ["direct human TB-500 trials", "human safety", "human PK/PD", "regulatory status confirmation"]
    },
    claims: [
      claim("tb500-tb4-mmp-remodeling", "biology.proteins", "Primary thymosin beta-4 wound-repair work showed increased MMP-1, MMP-2, and MMP-9 expression across wound-healing cell types.", ["A", "C"], ["pmid-16607611"], "preclinical", "mixed", 0.79),
      claim("tb500-tb4-vegf-akt", "biology.proteins", "Primary diabetic-wound work linked thymosin beta-4 to increased angiogenesis and VEGF/AKT signaling.", ["A", "C"], ["pmid-25204972"], "preclinical", "mixed", 0.76),
      claim("tb500-tb4-nfkb-il8", "biology.cytokinesInterleukins", "Primary cell work showed thymosin beta-4 inhibition of TNF-alpha-driven NF-kB activation and IL-8 expression.", ["C"], ["pmid-21343177"], "cell", "cell", 0.75),
      claim("tb500-enhancement-unknown", "expanded.enhancementPotential", "Healthy-human enhancement remains unverified in the imported TB-500/thymosin-beta-4-related record.", ["N", "?"], ["pmid-16607611"], "anecdotal_common_use", "unknown", 0.3)
    ],
    citations: [tb4Mmp, tb4Inflammation, tb4VegfAkt, source("peptpedia"), source("peptidePartnersShop")],
    moderation: { status: "needs_review" }
  },
  "tesamorelin": {
    names: { aliases: ["Egrifta", "Egrifta SV", "Egrifta WR"], tradeNames: ["Egrifta"] },
    classification: { evidenceTier: "fda_phase3", regulatoryStatus: "fda_approved" },
    tile: {
      mechanismSummary: "Tesamorelin is a GHRH analog used in HIV-associated abdominal adiposity contexts and studied through GH/IGF-1 and visceral-fat endpoints.",
      localization: "Pituitary GHRH receptor with downstream hepatic IGF-1 and adipose/liver metabolic effects.",
      enhancingEffects: [
        { label: "visceral adipose tissue reduction", symbols: ["Rx", "H"], claimRef: "tesamorelin-human-use" },
        { label: "GH/IGF-1 axis activation", symbols: ["H"], claimRef: "tesamorelin-human-use" },
        { label: "liver fat/body composition research", symbols: ["H"], claimRef: "tesamorelin-human-use" }
      ],
      sideEffects: ["Glucose/IGF-1/neoplasm-risk context requires label extraction.", "Benefits may cease after discontinuation according to review literature."],
      clinicalUses: ["FDA-approved therapy context for abdominal fat accumulation in people with HIV; exact product label wording must be imported."],
      dosing: {
        quick: "Clinical/FDA context: tesamorelin is studied/administered subcutaneously in HIV abdominal-fat trials; exact dose display must come from label or cited trial.",
        adminRoute: "Subcutaneous label/trial context; not enhancement advice.",
        publicDisplayAllowed: true,
        context: "fda_label"
      }
    },
    biology: {
      genes: ["GHRHR", "GH1", "IGF1", "IGFBP3"],
      proteins: ["GHRH receptor", "growth hormone", "IGF-1", "IGFBP-3"],
      receptors: ["GHRHR"],
      channelsTransporters: [],
      cytokinesInterleukins: [{ name: "CRP", type: "inflammatory_marker", effect: "measured in metabolic trial contexts; direction requires extraction", context: "human HIV/metabolic studies", symbols: ["H", "?"], claimRef: "tesamorelin-crp-pending" }],
      cascades: [
        { category: "GH axis signaling", steps: ["Tesamorelin binds pituitary GHRHR", "somatotroph GH pulse secretion increases", "hepatic IGF-1 and IGFBP-3 production rise downstream", "lipolysis and nutrient repartitioning increase in susceptible depots", "visceral adipose tissue decreases in cited HIV trial contexts"], symbols: ["H"], claimRef: "tesamorelin-human-use" },
        { category: "body-composition and liver-fat signaling", steps: ["GH / IGF-1 axis shifts adipose and hepatic substrate handling", "visceral fat falls more than many subcutaneous depots in target populations", "hepatic fat and body-composition endpoints may improve", "benefit remains disease-context specific rather than generic enhancement"], symbols: ["H", "R"], claimRef: "tesamorelin-human-use" }
      ]
    },
    expanded: {
      safetyRisks: [
        {
          system: "metabolic",
          label: "Metabolic / endocrine",
          color: "#6ee7b7",
          icon: "hexagon",
          helpSummary: "Human HIV-associated adiposity studies support visceral-fat reduction in indicated populations.",
          harmSummary: "Glucose and IGF-1 related risk context requires label- and trial-specific extraction before stronger claims.",
          citationIds: ["pmid-38905488"]
        }
      ],
      enhancementPotential: {
        summary: "Tesamorelin clearly intersects with physique and body-composition interest because of its GH/IGF-1 axis effects, but the strongest imported evidence is still disease-context clinical use.",
        caveat: "Do not collapse HIV-associated abdominal-fat evidence into generic healthy-human enhancement claims.",
        citationIds: ["pmid-38905488"]
      },
      anecdotalUse: ["Body-composition and enhancement discussion exists publicly, but it must remain separated from FDA and HIV-associated clinical-use evidence."]
    },
    claims: [claim("tesamorelin-human-use", "tile.clinicalUses", "Tesamorelin is described in PubMed as the only FDA-approved therapy to treat abdominal fat accumulation in people with HIV.", ["Rx", "H"], ["pmid-38905488"], "clinical_trial", "human", 0.82)],
    citations: [tesamorelinPubMed, source("peptpedia"), source("peptidePartnersShop")],
    moderation: { status: "needs_review" }
  },
  "thymosin-alpha-1": {
    names: { aliases: ["Thymalfasin", "Talpha1", "Zadaxin"], tradeNames: ["Zadaxin"] },
    classification: { evidenceTier: "human_clinical_development", regulatoryStatus: "non_us_approved" },
    tile: {
      mechanismSummary: "Thymosin alpha-1 is an immune-modulating thymic peptide studied in infection, inflammatory, hepatic, and adjunctive oncology contexts.",
      localization: "Immune-cell signaling networks including T-cell, dendritic-cell, toll-like receptor, and interferon-associated pathways.",
      enhancingEffects: [
        { label: "immune modulation", symbols: ["H", "R"], claimRef: "ta1-immune-modulation" },
        { label: "infection/inflammation outcomes", symbols: ["H", "R"], claimRef: "ta1-immune-modulation" },
        { label: "T-cell/interferon signaling", symbols: ["H", "R", "?"], claimRef: "ta1-cytokines" }
      ],
      sideEffects: ["Safety varies by disease context and co-therapies; import trial-level adverse events before strong claims."],
      clinicalUses: ["International clinical-use and investigational immune-adjuvant contexts; US FDA status requires official regulatory verification."],
      dosing: {
        quick: "Study/regional-label context only. Enhancement or wellness use is anecdotal/common-use unless tied to a cited study.",
        adminRoute: "Usually discussed as injectable in clinical literature; exact route/dose must remain citation-specific.",
        publicDisplayAllowed: false,
        context: "clinical_trial"
      }
    },
    biology: {
      genes: ["TLR9", "IFNA1", "IFNG", "IL2", "TNF"],
      proteins: ["TLR9", "interferon-alpha", "interferon-gamma", "IL-2", "TNF"],
      receptors: ["TLR-related innate immune pathways"],
      channelsTransporters: [],
      cytokinesInterleukins: [
        { name: "IFN-alpha", type: "cytokine", effect: "immune modulation context; direction requires claim-level extraction", context: "human/review literature", symbols: ["H", "R", "?"], claimRef: "ta1-cytokines" },
        { name: "IL-2", type: "interleukin", effect: "T-cell signaling context; direction requires claim-level extraction", context: "human/review literature", symbols: ["H", "R", "?"], claimRef: "ta1-cytokines" },
        { name: "TNF", type: "cytokine", effect: "inflammatory signaling context; direction requires claim-level extraction", context: "human/review literature", symbols: ["H", "R", "?"], claimRef: "ta1-cytokines" }
      ],
      cascades: [{ category: "immune", steps: ["thymic peptide signaling", "TLR/interferon/T-cell pathways", "cytokine immune modulation", "infection/inflammation outcomes"], symbols: ["H", "R"], claimRef: "ta1-immune-modulation" }]
    },
    claims: [claim("ta1-immune-modulation", "tile.mechanismSummary", "Thymosin alpha 1 is described as an immunomodulatory agent in clinical practice.", ["H", "R"], ["pmid-40599771"], "review", "human", 0.65)],
    citations: [thymosinMeta, source("peptpedia"), source("peptidePartnersShop")],
    moderation: { status: "needs_review" }
  },
  "sermorelin": {
    names: { aliases: ["GHRH(1-29)", "Geref", "Geref Diagnostic"], tradeNames: ["Geref Diagnostic"] },
    classification: { evidenceTier: "human_pk_pd", regulatoryStatus: "not_approved" },
    tile: {
      mechanismSummary: "Sermorelin is a GHRH(1-29) analog that stimulates endogenous pituitary growth-hormone release; historical FDA product context needs careful current-status labeling.",
      localization: "Pituitary GHRH receptor and downstream GH/IGF-1 endocrine axis.",
      enhancingEffects: [
        { label: "GH stimulation", symbols: ["H", "R"], claimRef: "sermorelin-gh-axis" },
        { label: "IGF-1 downstream axis", symbols: ["H", "R", "?"], claimRef: "sermorelin-gh-axis" },
        { label: "enhancement/anti-aging claims", symbols: ["N", "?"], claimRef: "sermorelin-anecdote" }
      ],
      sideEffects: ["Current compounded/off-label use should not be treated as FDA-approved therapeutic use.", "Adverse events require source-specific extraction."],
      clinicalUses: ["Historical diagnostic/therapeutic GH-axis context; current FDA availability/status needs official verification."],
      dosing: {
        quick: "Enhancement/common-use dose discussions are anecdotal/non-clinical unless tied to a cited study; do not display as advice.",
        adminRoute: "Clinical-study route/dose extraction pending; public display should remain context-labeled.",
        publicDisplayAllowed: false,
        context: "anecdotal_common_use"
      }
    },
    biology: {
      genes: ["GHRHR", "GH1", "IGF1"],
      proteins: ["GHRH receptor", "growth hormone", "IGF-1"],
      receptors: ["GHRHR"],
      channelsTransporters: [],
      cytokinesInterleukins: [],
      cascades: [
        { category: "GH axis signaling", steps: ["Sermorelin agonizes GHRHR", "pituitary GH pulse release increases", "hepatic IGF-1 signaling increases downstream", "growth/metabolic endpoints can change in clinical or investigational contexts"], symbols: ["H", "R"], claimRef: "sermorelin-gh-axis" }
      ]
    },
    expanded: {
      mechanismDetail: "Traceable draft cascade: sermorelin acts upstream of GH release at the GHRH receptor rather than acting as GH itself. Downstream IGF-1 and metabolic/body-composition effects are secondary endocrine consequences and must remain citation-specific.",
      anecdotalUse: ["Common anti-aging/enhancement discussions exist online; these are not clinical evidence and must be labeled separately."]
    },
    claims: [
      claim("sermorelin-gh-axis", "tile.mechanismSummary", "GHRH(1-29) analog that stimulates endogenous growth-hormone release.", ["H", "R"], [source("peptpedia").id], "review", "human", 0.55),
      claim("sermorelin-anecdote", "tile.dosing.quick", "Enhancement/common-use dose discussions are anecdotal/non-clinical unless tied to a cited study.", ["N", "?"], [source("peptpedia").id], "anecdotal_common_use", "unknown", 0.25)
    ],
    citations: [source("peptpedia"), source("peptidePartnersShop")],
    moderation: { status: "needs_review" }
  },
  "ll-37": {
    names: { aliases: ["Cathelicidin LL-37", "hCAP18/LL-37"], tradeNames: [] },
    classification: { evidenceTier: "translational", regulatoryStatus: "research_only" },
    tile: {
      mechanismSummary: "LL-37 is a human cathelicidin antimicrobial peptide with immunomodulatory effects in epithelial, neutrophil, macrophage, and antigen-presenting-cell contexts.",
      localization: "Innate immune barriers, epithelial surfaces, neutrophils, macrophages, dendritic cells, and inflamed tissues.",
      enhancingEffects: [
        { label: "antimicrobial host defense", symbols: ["C", "A", "R"], claimRef: "ll37-host-defense" },
        { label: "IFN-gamma response modulation", symbols: ["C"], claimRef: "ll37-ifng-modulation" },
        { label: "neutrophil cytokine release modulation", symbols: ["C"], claimRef: "ll37-neutrophil-cytokines" }
      ],
      sideEffects: ["Human enhancement use is not established; immune activation/suppression can be context-dependent.", "Cancer/inflammation contexts are complex and require disease-specific evidence."],
      clinicalUses: ["Research-only antimicrobial and immune-modulating peptide context; no FDA-approved LL-37 therapeutic product identified."],
      dosing: {
        quick: "No FDA label or verified human-use dose context. Common-use reports, if shown, must be anecdotal and non-clinical.",
        adminRoute: "Research/study context only; route/dose requires exact citation.",
        publicDisplayAllowed: false,
        context: "unknown"
      }
    },
    biology: {
      genes: ["CAMP", "IFNG", "IL1B", "TNF", "CXCL8"],
      proteins: ["LL-37", "IFN-gamma", "IL-1beta", "TNF", "IL-8/CXCL8"],
      receptors: ["TLR-related innate immune pathways", "formyl peptide receptor contexts require verification"],
      channelsTransporters: [],
      cytokinesInterleukins: [
        { name: "IFN-gamma", type: "cytokine", effect: "LL-37 inhibited IFN-gamma responses in antigen-presenting-cell study context", context: "human immune cells in vitro", symbols: ["C"], claimRef: "ll37-ifng-modulation" },
        { name: "IL-1beta", type: "interleukin", effect: "stimulus-dependent modulation; exact direction requires extraction", context: "human neutrophil/cell contexts", symbols: ["C", "?"], claimRef: "ll37-neutrophil-cytokines" },
        { name: "TNF", type: "cytokine", effect: "stimulus-dependent modulation; exact direction requires extraction", context: "human neutrophil/cell contexts", symbols: ["C", "?"], claimRef: "ll37-neutrophil-cytokines" },
        { name: "IL-8/CXCL8", type: "chemokine", effect: "host-defense/inflammatory response marker; exact direction requires extraction", context: "human neutrophil/cell contexts", symbols: ["C", "?"], claimRef: "ll37-neutrophil-cytokines" }
      ],
      cascades: [{ category: "immune", steps: ["LL-37", "microbial/cytokine stimulus", "APC/neutrophil cytokine response", "host-defense/inflammation modulation"], symbols: ["C"], claimRef: "ll37-neutrophil-cytokines" }]
    },
    claims: [
      claim("ll37-ifng-modulation", "biology.cytokinesInterleukins", "LL-37 inhibited cellular responses to IFN-gamma in antigen-presenting-cell contexts.", ["C"], ["pmid-19812202"], "cell", "cell", 0.75),
      claim("ll37-neutrophil-cytokines", "biology.cytokinesInterleukins", "LL-37 modulates inflammatory and host-defense responses of human neutrophils.", ["C"], ["pmid-20140902"], "cell", "cell", 0.72)
    ],
    citations: [ll37Ifn, ll37Neutrophil, source("peptpedia")],
    moderation: { status: "needs_review" }
  },
  "ss-31": {
    names: { aliases: ["Elamipretide", "MTP-131", "Bendavia"], tradeNames: [] },
    classification: { evidenceTier: "human_phase2", regulatoryStatus: "investigational" },
    tile: {
      mechanismSummary: "SS-31/elamipretide is a mitochondria-targeted tetrapeptide that transiently localizes to the inner mitochondrial membrane and associates with cardiolipin.",
      localization: "Inner mitochondrial membrane and cardiolipin-rich mitochondrial compartments.",
      enhancingEffects: [
        { label: "exercise performance in primary mitochondrial myopathy trial", symbols: ["H"], claimRef: "ss31-human-exercise" },
        { label: "mitochondrial membrane/cardiolipin biology", symbols: ["H", "A", "C"], claimRef: "ss31-human-exercise" },
        { label: "enhancement in healthy humans", symbols: ["?"], claimRef: "ss31-enhancement-unknown" }
      ],
      sideEffects: ["The attached Consensus export reports no increased safety concerns in one short PMM trial; this is not proof of broad safety.", "Healthy-human enhancement evidence is not established in the current imported source set."],
      clinicalUses: ["Investigational mitochondrial-disease and ophthalmology contexts; no broad FDA approval in current source set."],
      dosing: {
        quick: "Clinical trial context: intravenous elamipretide dose-escalation arms were used for 5 days in PMM; not enhancement advice.",
        adminRoute: "Trial route/dose context only; healthy enhancement dose remains unverified.",
        publicDisplayAllowed: true,
        context: "clinical_trial"
      }
    },
    biology: {
      genes: ["CYCS", "TFAM", "PPARGC1A", "SOD2", "CRLS1", "SLC25A4"],
      proteins: ["cardiolipin", "cytochrome c", "TFAM", "PGC-1alpha", "SOD2", "ANT"],
      receptors: ["cardiolipin binding context"],
      channelsTransporters: ["adenine nucleotide translocator", "mitochondrial permeability-transition context requires verification"],
      cytokinesInterleukins: [{ name: "ROS", type: "other", effect: "mitochondrial oxidative-stress marker; trial/source-specific direction requires extraction", context: "mitochondrial disease/preclinical contexts", symbols: ["H", "A", "C", "?"], claimRef: "ss31-human-exercise" }],
      cascades: [
        { category: "mitochondrial membrane signaling", steps: ["SS-31 partitions into the inner mitochondrial membrane", "cardiolipin-associated membrane surface electrostatics are modulated", "cristae architecture and respiratory-supercomplex organization may stabilize", "cytochrome-c peroxidase / ROS leak stress may decrease", "ATP-generating efficiency may improve"], symbols: ["H", "A", "C"], claimRef: "ss31-cardiolipin-mechanism" },
        { category: "ADP transport and energetics", steps: ["aged mitochondria show impaired ADP sensitivity", "SS-31 increases ANT-linked ADP uptake in mechanistic work", "ADP delivery to ATP synthase improves", "oxidative-phosphorylation responsiveness rises", "force / energetic efficiency may improve in aged-animal systems"], symbols: ["A", "C"], claimRef: "ss31-ant-adp" },
        { category: "clinical functional signaling", steps: ["mitochondrial energetic stress burden may decrease", "skeletal-muscle fatigue burden may decrease", "short-duration exercise performance may improve in mitochondrial disease", "6-minute-walk distance improved in one imported PMM randomized trial", "healthy-human enhancement remains unverified"], symbols: ["H"], claimRef: "ss31-human-exercise" }
      ]
    },
    expanded: {
      humanEvidence: "A 36-participant randomized PMM trial is imported and supports short-duration exercise-performance improvement without increased safety concerns in that study; additional short human elamipretide studies in AMD and heart failure remain indication-specific and do not establish broad healthy-human benefit.",
      mechanismDetail: "The SS-31 pathway now shown is: inner-membrane partitioning -> cardiolipin-linked membrane/electrostatic stabilization -> improved cristae respiratory organization -> improved ANT-mediated ADP handling -> improved oxidative phosphorylation efficiency. Clinical findings such as 6MWT change in mitochondrial myopathy sit downstream of that mitochondrial-bioenergetic cascade.",
      safetyDetail: "Short human studies are directionally reassuring but still limited. Injection-site reactions were common in some subcutaneous programs, and absence of broad severe toxicity in short trials is not the same thing as proven healthy-human safety or enhancement utility.",
      safetyRisks: [
        {
          system: "musculoskeletal",
          label: "Musculoskeletal / exercise",
          color: "#c4b5fd",
          icon: "muscle",
          helpSummary: "Primary mitochondrial-myopathy trial reported short-duration 6MWT improvement in a disease population.",
          harmSummary: null,
          citationIds: ["consensus-ss31-karaa-2018"]
        },
        {
          system: "dermatologic",
          label: "Dermatologic / injection site",
          color: "#f9a8d4",
          icon: "skin",
          helpSummary: null,
          harmSummary: "Short human elamipretide programs reported mild to moderate injection-site reactions in subcutaneous use contexts.",
          citationIds: ["consensus-ss31-karaa-2018"]
        }
      ],
      enhancementPotential: {
        summary: "SS-31 is often framed as a mitochondrial or endurance enhancer, but the imported human evidence is disease-context clinical development rather than healthy-human enhancement.",
        caveat: "Animal and mechanistic bioenergetic data should not be translated into claims of improved normal human physiology without direct trials.",
        citationIds: ["consensus-ss31-karaa-2018", "doi-10-1074-jbc-ra119-012094", "doi-10-1007-s11357-023-00861-y"]
      },
      anecdotalUse: ["Healthy-human mitochondrial/performance enhancement claims are discussed publicly, but the imported human evidence does not establish that use."]
    },
    claims: [
      claim("ss31-human-exercise", "expanded.humanEvidence", "Elamipretide improved 6MWT/exercise performance after 5 days in adults with primary mitochondrial myopathy in the imported randomized trial row.", ["H"], ["consensus-ss31-karaa-2018"], "clinical_trial", "human", 0.78, { population: "Adults with genetically confirmed primary mitochondrial myopathy", sampleSize: "n=36", route: "IV infusion", duration: "5 days" }),
      claim("ss31-cardiolipin-mechanism", "biology.proteins", "Primary mechanistic work showed SS-31 binding to lipid bilayers and modulation of membrane surface electrostatics as part of its cardiolipin-linked mechanism.", ["C"], ["doi-10-1074-jbc-ra119-012094"], "cell", "cell", 0.74),
      claim("ss31-ant-adp", "biology.channelsTransporters", "Primary mechanistic aging work linked SS-31 to improved ADP sensitivity through ANT-associated mitochondrial uptake.", ["A", "C"], ["doi-10-1007-s11357-023-00861-y"], "preclinical", "mixed", 0.72),
      claim("ss31-enhancement-unknown", "tile.enhancingEffects", "Healthy-human enhancement evidence is not established in the current imported source set.", ["?"], ["consensus-ss31-karaa-2018"], "unknown", "unknown", 0.35)
    ],
    citations: [ss31Consensus, ss31Membrane, ss31Ant, source("peptidePartnersShop"), source("peptidePartnersCerts")],
    moderation: { status: "needs_review" }
  }
};

const vendorIds = new Set(["bpc-157", "tb-500", "ipamorelin", "cjc-1295", "semaglutide", "retatrutide", "ghk-cu", "pt-141", "ss-31", "tirzepatide", "tesamorelin", "thymosin-alpha-1", "sermorelin", "ll-37"]);

export const peptideRecords: PeptideRecord[] = catalog.map((row) => {
  const base = baseRecord(row);
  const patched = mergeRecord(base, curated[base.id] ?? {});
  const finnrickRows = finnrickVendorRows(patched.id);
  if (finnrickRows.length) {
    patched.vendorData = finnrickRows;
    const noteLines = vendorNotes(patched.id);
    if (noteLines.length) {
      patched.expanded.missingEvidence = [...new Set([...patched.expanded.missingEvidence, "price data", "vendor website / availability", "per-sample COA detail"])];
      patched.expanded.manufacturers = [
        ...patched.expanded.manufacturers,
        {
          name: "Finnrick vendor summary batch",
          type: "public vendor-quality aggregation",
          notes: noteLines.join(" ")
        }
      ];
    }
  } else if (vendorIds.has(patched.id) && patched.vendorData.length === 0) {
    patched.vendorData = [{
      vendor: "Peptide Partners",
      productName: patched.names.primary,
      productUrl: "https://peptide.partners/shop/",
      vialSize: patched.tile.cost.size,
      priceRange: patched.tile.cost.range,
      batchId: null,
      manufacturerId: null,
      purity: null,
      endotoxin: "unknown",
      heavyMetals: "unknown",
      sterility: "unknown",
      lab: null,
      coaUrl: "https://peptide.partners/independent-certifications/",
      date: null,
      symbols: ["V"]
    }];
    if (!patched.citations.some((c) => c.id === source("peptidePartnersShop").id)) patched.citations.push(source("peptidePartnersShop"));
  }
  return patched;
});

export const sourceRegistry = [
  {
    id: "consensus-csv",
    name: "Consensus CSV/RIS manual exports",
    status: "active_manual_import",
    use: "Paper discovery and citation candidate import until API access exists."
  },
  {
    id: "pubmed-fda",
    name: "PubMed / FDA / ClinicalTrials",
    status: "planned_primary_verification",
    use: "Primary/regulatory verification for claims, dosing context, and safety."
  },
  {
    id: "moderator-review",
    name: "Human moderator verification",
    status: "schema_ready",
    use: "Other models and human mods review each model-drafted claim before high-risk publication."
  }
];
