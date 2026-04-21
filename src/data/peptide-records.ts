import type { Citation, Claim, EvidenceSymbol, PeptideRecord } from "@/types/peptide";

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

function claim(id: string, field: string, value: string, symbols: EvidenceSymbol[], citationIds: string[], context: Claim["context"] = "review", species: Claim["species"] = "mixed", confidence = 0.45): Claim {
  return {
    id,
    field,
    value,
    species,
    context,
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
      cascades: [{ category: "metabolic", steps: ["GLP-1R/GIPR", "cAMP signaling", "insulin/glucagon/appetite pathways", "glycemic and weight outcomes"], symbols: ["Rx", "H"], claimRef: "tirzepatide-fda-use" }]
    },
    expanded: {
      humanEvidence: "FDA-recognized branded products provide strong human regulatory evidence; trial-level outcomes should be imported from labels and pivotal publications.",
      safetyDetail: "Display label-specific adverse events, contraindications, and boxed warnings only after label import. Common/nonclinical enhancement anecdotes must remain separate from label evidence.",
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
      cascades: [{ category: "metabolic", steps: ["GLP-1R", "cAMP", "insulin/glucagon and appetite signaling", "glycemic and weight outcomes"], symbols: ["Rx", "H"], claimRef: "liraglutide-fda-use" }]
    },
    claims: [claim("liraglutide-fda-use", "tile.clinicalUses", "Victoza is FDA-approved as adjunct to diet and exercise to improve glycemic control in adults with type 2 diabetes.", ["Rx", "H"], ["fda-liraglutide-victoza"], "fda_label", "human", 0.9)],
    citations: [fdaLiraglutide, source("peptpedia")],
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
      cascades: [{ category: "endocrine", steps: ["GHRHR", "pituitary GH", "hepatic IGF-1", "visceral adiposity/body composition"], symbols: ["H"], claimRef: "tesamorelin-human-use" }]
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
      cascades: [{ category: "endocrine", steps: ["GHRHR", "pituitary GH release", "IGF-1 axis", "growth/metabolic endpoints"], symbols: ["H", "R"], claimRef: "sermorelin-gh-axis" }]
    },
    expanded: { anecdotalUse: ["Common anti-aging/enhancement discussions exist online; these are not clinical evidence and must be labeled separately."] },
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
      genes: ["CYCS", "TFAM", "PPARGC1A", "SOD2", "CRLS1"],
      proteins: ["cardiolipin", "cytochrome c", "TFAM", "PGC-1alpha", "SOD2"],
      receptors: ["cardiolipin binding context"],
      channelsTransporters: ["mitochondrial permeability transition context requires verification"],
      cytokinesInterleukins: [{ name: "ROS", type: "other", effect: "mitochondrial oxidative-stress marker; trial/source-specific direction requires extraction", context: "mitochondrial disease/preclinical contexts", symbols: ["H", "A", "C", "?"], claimRef: "ss31-human-exercise" }],
      cascades: [{ category: "mitochondrial", steps: ["SS-31/elamipretide", "inner mitochondrial membrane/cardiolipin", "mitochondrial energetics", "6-minute walk/exercise endpoints in PMM trial"], symbols: ["H"], claimRef: "ss31-human-exercise" }]
    },
    expanded: {
      humanEvidence: "Consensus CSV row describes a 36-participant randomized, double-blind, placebo-controlled dose-escalation trial in adults with genetically confirmed primary mitochondrial myopathy; the highest-dose group improved 6MWT distance in short-term treatment without increased safety concerns in that trial.",
      safetyDetail: "Short trial safety observations do not establish broad or healthy-human safety. Enhancement use in healthy physiology remains unverified and should be labeled unknown/anecdotal if encountered.",
      anecdotalUse: ["Healthy-human enhancement claims are not supported by the imported Consensus CSV and should remain unknown unless new evidence is imported."]
    },
    claims: [
      claim("ss31-human-exercise", "expanded.humanEvidence", "Elamipretide improved 6MWT/exercise performance after 5 days in adults with primary mitochondrial myopathy in the imported Consensus trial row.", ["H"], ["consensus-ss31-karaa-2018"], "clinical_trial", "human", 0.78),
      claim("ss31-enhancement-unknown", "tile.enhancingEffects", "Healthy-human enhancement evidence is not established in the current imported source set.", ["?"], ["consensus-ss31-karaa-2018"], "unknown", "unknown", 0.35)
    ],
    citations: [ss31Consensus, source("peptidePartnersShop"), source("peptidePartnersCerts")],
    moderation: { status: "needs_review" }
  }
};

const vendorIds = new Set(["bpc-157", "tb-500", "ipamorelin", "cjc-1295", "semaglutide", "retatrutide", "ghk-cu", "pt-141", "ss-31", "tirzepatide", "tesamorelin", "thymosin-alpha-1", "sermorelin", "ll-37"]);

export const peptideRecords: PeptideRecord[] = catalog.map((row) => {
  const base = baseRecord(row);
  const patched = mergeRecord(base, curated[base.id] ?? {});
  if (vendorIds.has(patched.id) && patched.vendorData.length === 0) {
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
