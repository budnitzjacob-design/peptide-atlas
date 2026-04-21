const DATA = window.PEPTIDE_ATLAS_DATA;
const BRAND = "peptocopeia";
const app = document.getElementById("app");

function mobileViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches;
}

function makeDefaultState() {
  const mobile = mobileViewport();
  return {
    query: "",
    category: "All",
    sort: "random",
    selected: null,
    tag: null,
    structureZoom: null,
    keySymbol: null,
    studyFilter: "all",
    bibliographyOpen: false,
    lineFeature: !mobile,
    scrollersOn: false,
    brandAlt: false,
    notice: ""
  };
}

const defaultState = makeDefaultState();

function gridOnlyRender() {
  const tiles = app.querySelector(".tiles");
  if (!tiles) {
    render();
    return;
  }
  tiles.innerHTML = filteredPeptides().map(tile).join("");
}

const baseState = {
  query: "",
  category: "All",
  sort: "random",
  selected: null,
  tag: null,
  structureZoom: null,
  keySymbol: null,
  studyFilter: "all",
  bibliographyOpen: false
};
let state = { ...baseState, ...defaultState };
const tagSummaryCache = new Map();
let citationRegistry = { citations: [], index: new Map() };
let pendingDetailScrollTop = null;
let noticeTimer = null;
function tileSizeScore(peptide) {
  return (
    peptide.names.primary.length * 2 +
    (peptide.tile.mechanismSummary || "").length +
    (peptide.tile.clinicalUses[0] || "").length +
    ((peptide.expanded.anecdotalUse[0] || "").length * 0.8) +
    ((peptide.tile.sideEffects[0] || "").length * 0.8) +
    peptide.tile.enhancingEffects.slice(0, 4).reduce((total, effect) => total + (effect.label || "").length, 0) * 0.35 +
    peptide.biology.proteins.slice(0, 5).reduce((total, item) => total + (item || "").length, 0) * 0.15
  );
}

const RANDOM_ORDER = new Map(
  [...DATA.peptides]
    .map((peptide) => ({
      id: peptide.id,
      bucket: Math.floor(tileSizeScore(peptide) / 80),
      rand: Math.random()
    }))
    .sort((a, b) => a.bucket - b.bucket || a.rand - b.rand)
    .map((item, index) => [item.id, index])
);

const CATEGORY_COLORS = {
  Metabolic: "#ff5a1f",
  "Growth Factors": "#c4b5fd",
  "Recovery & Repair": "#fda4af",
  "Anti-Aging": "#f9a8d4",
  Mitochondrial: "#93c5fd",
  "Immune Support": "#6ee7b7",
  "Cognitive Enhancement": "#fcd34d",
  "Sleep & Relaxation": "#a5b4fc",
  "Melanocortin / Metabolic": "#fdba74",
  "Reproductive / Metabolic": "#f9a8d4"
};

refreshCitationRegistry();

function refreshCitationRegistry() {
  const citations = [];
  const index = new Map();
  for (const peptide of DATA.peptides) {
    for (const citation of peptide.citations) {
      if (!index.has(citation.id)) {
        index.set(citation.id, citations.length + 1);
        citations.push(citation);
      }
    }
  }
  citationRegistry = { citations, index };
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function captureFocus() {
  const active = document.activeElement;
  if (!active || !active.dataset || !active.dataset.focusKey) return null;
  return {
    key: active.dataset.focusKey,
    start: active.selectionStart ?? null,
    end: active.selectionEnd ?? null
  };
}

function restoreFocus(snapshot) {
  if (!snapshot) return;
  const next = app.querySelector(`[data-focus-key="${snapshot.key}"]`);
  if (!next) return;
  next.focus({ preventScroll: true });
  if (snapshot.start !== null && typeof next.setSelectionRange === "function") {
    next.setSelectionRange(snapshot.start, snapshot.end ?? snapshot.start);
  }
}

function symbols(items = []) {
  return `<span class="symbols">${items
    .map(
      (symbol) =>
        `<button class="symbol-button" type="button" data-open-key="${esc(symbol)}" aria-label="${esc(
          DATA.evidenceLegend[symbol] || "unmapped evidence symbol"
        )}" title="${esc(DATA.evidenceLegend[symbol] || "unmapped evidence symbol")}">${symbolGlyph(symbol)}</button>`
    )
    .join("")}</span>`;
}

function symbolGlyph(symbol) {
  const glyphs = {
    H: '<span class="glyph-face">&#9786;</span>',
    A: '<svg class="paw-glyph" viewBox="0 0 24 24" aria-hidden="true"><circle cx="7" cy="8" r="2.1"></circle><circle cx="12" cy="6.4" r="2.1"></circle><circle cx="17" cy="8" r="2.1"></circle><circle cx="6.2" cy="13.1" r="1.9"></circle><path d="M12 11.4c-3.25 0-5.8 2.32-5.8 5 0 1.52 1.18 2.6 2.82 2.6 1.02 0 1.85-.37 2.49-.82.43-.29.76-.53 1.01-.53s.58.24 1.01.53c.64.45 1.47.82 2.49.82 1.64 0 2.82-1.08 2.82-2.6 0-2.68-2.55-5-5.84-5z"></path></svg>'
  };
  return glyphs[symbol] || esc(symbol);
}

function regulatoryLabel(status) {
  const labels = {
    fda_approved: "FDA-approved or FDA-recognized product context.",
    non_us_approved: "Approval/use context exists outside the United States.",
    investigational: "Investigational or in clinical development.",
    research_only: "Research-only context; not established for clinical use.",
    not_approved: "Not approved for clinical use in the current imported record.",
    unknown: "Regulatory status not fully extracted yet."
  };
  return labels[status] || status.replaceAll("_", " ");
}

function dosingContextLabel(context) {
  const labels = {
    fda_label: "Dose displayed from an FDA-approved or regulator label context.",
    clinical_trial: "Dose displayed from a clinical-trial context; it is descriptive, not a recommendation.",
    observational: "Dose displayed from observational human use, not a controlled dosing standard.",
    preclinical: "Dose displayed from animal or preclinical work and should not be read as human guidance.",
    cell: "Dose displayed from cell or bench context only.",
    review: "Dose displayed from a secondary synthesis rather than a primary trial protocol.",
    vendor: "Dose displayed from a vendor context and should not be read as efficacy guidance.",
    anecdotal_common_use: "Dose displayed from anecdotal/common-use context only and not as clinical evidence.",
    unknown: "Dosing context has not been fully extracted yet."
  };
  return labels[context] || String(context || "").replaceAll("_", " ");
}

function evidenceTierExplanation(tier) {
  const labels = {
    fda_phase3: "Backed by an FDA label or late-phase human evidence in the imported record.",
    human_phase3: "Anchored by phase 3 human trial evidence.",
    human_phase2: "Anchored by phase 2 human trial evidence.",
    human_clinical_development: "Human clinical evidence exists, but the current imported record is not phase-3-grade.",
    human_pk_pd: "Human pharmacokinetic or pharmacodynamic evidence exists, but outcome evidence is narrower.",
    human_topical_and_mechanistic: "Human mechanistic or topical evidence exists, but not broad systemic efficacy evidence.",
    translational: "Mixed human-adjacent and preclinical evidence supports plausibility.",
    preclinical: "Current support is mainly animal or cell evidence.",
    secondary_only: "Current record is still leaning on review-level or secondary synthesis and needs more primary verification.",
    conflict: "The imported evidence base contains meaningful conflict or unresolved inconsistency."
  };
  return labels[tier] || evidenceTierTitle(tier);
}

function moderationExplanation(status) {
  const labels = {
    verified: "A moderator has checked the imported evidence and signed off on the current record.",
    conflict: "A moderator or model flagged a meaningful conflict that still needs resolution.",
    model_drafted: "The record is model-drafted and still awaiting human or moderator verification.",
    needs_review: "The record contains enough uncertainty or risk that moderator review is specifically requested.",
    unreviewed: "The record has not yet been through a moderator verification pass."
  };
  return labels[status] || moderationLabel(status);
}

function evidenceTierTitle(tier) {
  return `${DATA.evidenceTierLabel[tier] || tier}: current imported evidence strength summary.`;
}

function formatPeptideName(name) {
  return esc(name).replace(/-([a-z]+)/g, '-<span class="name-lower">$1</span>');
}

function categoryColor(category) {
  return CATEGORY_COLORS[category] || "#9fb0c4";
}

function hexToRgb(hex) {
  const raw = (hex || "").replace("#", "");
  if (raw.length !== 6) return "159,176,196";
  const value = Number.parseInt(raw, 16);
  return `${(value >> 16) & 255},${(value >> 8) & 255},${value & 255}`;
}

function evidenceClass(tier) {
  if (tier.includes("fda") || tier.includes("phase3")) return "high";
  if (tier.includes("human")) return "human";
  if (tier === "conflict") return "conflict";
  return "early";
}

function tileEvidenceTags(p) {
  const tags = [];
  const tierLabel = DATA.evidenceTierLabel[p.classification.evidenceTier];
  if (tierLabel) {
    tags.push({ kind: `evidence-badge ${evidenceClass(p.classification.evidenceTier)}`, label: tierLabel });
  }

  const preferredSymbols = ["Rx", "H", "A", "C", "R"];
  const seen = new Set();
  for (const claim of p.claims) {
    for (const symbol of claim.symbols || []) {
      if (preferredSymbols.includes(symbol) && !seen.has(symbol)) {
        seen.add(symbol);
        tags.push({ kind: "mini-tag", label: DATA.evidenceLegend[symbol] || symbol });
      }
    }
  }

  return tags.slice(0, 2);
}

function moderationLabel(status) {
  const labels = {
    verified: "Verified by moderator",
    conflict: "Evidence conflict flagged",
    model_drafted: "Model-drafted: pending human/mod verification",
    needs_review: "Needs moderator review",
    unreviewed: "Unreviewed"
  };
  return labels[status] || status.replaceAll("_", " ");
}

function citationNumber(citation) {
  return citationRegistry.index.get(citation.id) || "?";
}

function peptideUrl(peptideOrId) {
  if (typeof window === "undefined") return "";
  const id = typeof peptideOrId === "string" ? peptideOrId : peptideOrId?.id;
  return `${window.location.origin}${window.location.pathname}${id ? `#${encodeURIComponent(id)}` : ""}`;
}

function peptideFromLocation() {
  if (typeof window === "undefined") return null;
  const id = decodeURIComponent((window.location.hash || "").replace(/^#/, ""));
  if (!id) return null;
  return DATA.peptides.find((peptide) => peptide.id === id) || null;
}

function setNotice(message) {
  state.notice = message;
  if (noticeTimer) window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    state.notice = "";
    render();
  }, 1800);
}

function createDefinitionExpander() {
  const seen = new Set();
  const rules = [
    ["GLP-1R", "glucagon-like peptide-1 receptor (GLP-1R)"],
    ["GIPR", "glucose-dependent insulinotropic polypeptide receptor (GIPR)"],
    ["GCGR", "glucagon receptor (GCGR)"],
    ["GHRHR", "growth hormone-releasing hormone receptor (GHRHR)"],
    ["GHSR-1a", "growth hormone secretagogue receptor 1a (GHSR-1a)"],
    ["GHSR", "growth hormone secretagogue receptor (GHSR)"],
    ["OXTR", "oxytocin receptor (OXTR)"],
    ["MC4R", "melanocortin 4 receptor (MC4R)"],
    ["MC3R", "melanocortin 3 receptor (MC3R)"],
    ["BDNF", "brain-derived neurotrophic factor (BDNF)"],
    ["NGF", "nerve growth factor (NGF)"],
    ["TrkB", "tropomyosin receptor kinase B (TrkB)"],
    ["CNTFR", "ciliary neurotrophic factor receptor (CNTFR)"],
    ["STAT3", "signal transducer and activator of transcription 3 (STAT3)"],
    ["BAX", "BCL2-associated X protein (BAX)"],
    ["IGFBP-3", "insulin-like growth factor-binding protein 3 (IGFBP-3)"],
    ["PI3K", "phosphoinositide 3-kinase (PI3K)"],
    ["Akt", "protein kinase B (Akt)"],
    ["MAPK", "mitogen-activated protein kinase (MAPK)"],
    ["ERK", "extracellular signal-regulated kinase (ERK)"],
    ["JNK", "c-Jun N-terminal kinase (JNK)"],
    ["PKA", "protein kinase A (PKA)"],
    ["CREB", "cAMP response element-binding protein (CREB)"],
    ["cAMP", "cyclic adenosine monophosphate (cAMP)"],
    ["IP3", "inositol 1,4,5-trisphosphate (IP3)"],
    ["DAG", "diacylglycerol (DAG)"],
    ["BBB", "blood-brain barrier (BBB)"],
    ["CSF", "cerebrospinal fluid (CSF)"],
    ["CNS", "central nervous system (CNS)"],
    ["RCT", "randomized controlled trial (RCT)"],
    ["T2D", "type 2 diabetes (T2D)"],
    ["MASH", "metabolic dysfunction-associated steatohepatitis (MASH)"],
    ["TBI", "traumatic brain injury (TBI)"],
    ["ASD", "autism spectrum disorder (ASD)"],
    ["IV", "intravenous (IV)"],
    ["IM", "intramuscular (IM)"],
    ["IP", "intraperitoneal (IP)"],
    ["SC", "subcutaneous (SC)"],
    ["GH", "growth hormone (GH)"],
    ["IGF-1", "insulin-like growth factor 1 (IGF-1)"],
    ["ACTH", "adrenocorticotropic hormone (ACTH)"],
    ["PRL", "prolactin (PRL)"],
    ["HPA", "hypothalamic-pituitary-adrenal (HPA)"],
    ["FDA", "U.S. Food and Drug Administration (FDA)"],
    ["EMA", "European Medicines Agency (EMA)"],
    ["PMDA", "Pharmaceuticals and Medical Devices Agency of Japan (PMDA)"],
    ["NMPA", "National Medical Products Administration of China (NMPA)"],
    ["CVOT", "cardiovascular outcomes trial (CVOT)"],
    ["tMCAO", "transient middle cerebral artery occlusion (tMCAO)"],
    ["pMCAO", "permanent middle cerebral artery occlusion (pMCAO)"]
  ];

  return (text) => {
    let output = String(text || "");
    for (const [abbr, expanded] of rules) {
      if (seen.has(abbr)) continue;
      const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(^|[^A-Za-z0-9-])(${escaped})(?=$|[^A-Za-z0-9-])`);
      if (regex.test(output)) {
        output = output.replace(regex, `$1${expanded}`);
        seen.add(abbr);
      }
    }
    return output;
  };
}

function citationLink(citation) {
  const number = citationNumber(citation);
  return `<span class="citation" tabindex="0">
    <a href="${esc(citation.url)}" target="_blank" rel="noreferrer">[${number}]</a>
    <span class="citation-popover">
      <strong>${esc(citation.title)}</strong>
      <span>${esc((citation.authors || []).join(", "))} ${esc(citation.year ? `(${citation.year})` : "")}</span>
      <span>${esc(citation.notes)}</span>
      <span>Retrieved ${esc(citation.accessedAt || "date pending")}</span>
    </span>
  </span>`;
}

function citationRefsByIds(peptide, ids = []) {
  return ids
    .map((id) => peptide.citations.find((citation) => citation.id === id))
    .filter(Boolean)
    .map((citation) => citationLink(citation))
    .join("");
}

function sectionCitationIds(peptide, section) {
  const matchers = {
    human: (claim) => claim.species === "human" || ["fda_label", "clinical_trial", "observational"].includes(claim.context),
    animal: (claim) => ["animal", "mixed", "cell"].includes(claim.species) || ["preclinical", "cell", "review"].includes(claim.context),
    mechanism: (claim) => /mechanism|biology|proteins|receptors|channels|classification/.test(`${claim.field || ""}`.toLowerCase())
  };
  const matcher = matchers[section];
  return [...new Set((peptide.claims || []).filter(matcher).flatMap((claim) => claim.citationIds || []))].slice(0, 4);
}

function cleanNarrativeText(peptide, text, define = (value) => String(value || "")) {
  const properties = peptide?.identity?.properties || {};
  const halfLifeValue = properties?.halfLife?.value || null;
  let output = define(String(text || ""));
  output = output
    .replace(/\(([A-Z][A-Za-z-]+(?:,?\s+[A-Z][A-Za-z-]+)*\s+et al\.,?\s*[^)]*)\)/g, "")
    .replace(/\b[A-Z][A-Za-z-]+(?:,\s*[A-Z][A-Za-z-]+)?\s+et al\.?\s*\d{4}\b/g, "")
    .replace(/\b[A-Z][A-Za-z-]+\s+\d{4}\b/g, "")
    .replace(/\(\s*,\s*/g, "(")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();

  if (halfLifeValue && /half-life is short/i.test(output)) {
    output = output.replace(/Half-life is short\.?/i, `Elimination half-life is ${halfLifeValue}.`);
  }
  if (halfLifeValue && /very short half-life/i.test(output)) {
    output = output.replace(/very short half-life/i, `reported short half-life (${halfLifeValue})`);
  }
  return output.replace(/\s{2,}/g, " ").trim();
}

function identityValueWithCitations(peptide, property, fallbackText) {
  if (!property || (!property.value && !property.note)) return esc(fallbackText);
  const value = property.value ? esc(property.value) : "";
  const note = property.note ? `<span class="identity-note">${esc(property.note)}</span>` : "";
  const cites = property.citationIds?.length ? `<span class="identity-cites">${citationRefsByIds(peptide, property.citationIds)}</span>` : "";
  return [value, note, cites].filter(Boolean).join(" ");
}

function hasHumanStudies(peptide) {
  return (
    peptide.classification.evidenceTier.includes("human") ||
    peptide.classification.evidenceTier.includes("fda") ||
    peptide.claims.some((claim) => claim.species === "human" && !["anecdotal_common_use", "vendor"].includes(claim.context))
  );
}

function hasAnimalStudies(peptide) {
  return peptide.claims.some((claim) => ["animal", "mixed"].includes(claim.species) && ["preclinical", "review", "cell", "clinical_trial"].includes(claim.context));
}

function tag(type, value, sy = [], sourcePeptideId = "", label = value) {
  return `<span class="tag-cluster">
    <button class="tag tag-${esc(type)}" data-tag-type="${esc(type)}" data-tag-value="${esc(value)}" data-tag-source="${esc(sourcePeptideId)}">
      ${esc(label)}
    </button>
    ${sy.length ? symbols(sy) : ""}
  </span>`;
}

function tileStructurePreview(p) {
  if (!state.brandAlt) return "";
  return `<div class="tile-structure" aria-hidden="true">
    <img src="/structures/${esc(p.id)}.png" alt="" loading="lazy" onerror="this.closest('.tile-structure')?.remove()">
  </div>`;
}

function searchable(p) {
  return [
    p.names.primary,
    ...p.names.aliases,
    ...p.names.tradeNames,
    p.category,
    p.classification.peptideClass,
    p.tile.mechanismSummary,
    p.tile.localization,
    p.tile.clinicalUses.join(" "),
    p.tile.sideEffects.join(" "),
    p.expanded.humanEvidence,
    p.expanded.animalEvidence,
    p.expanded.anecdotalUse.join(" "),
    p.biology.genes.join(" "),
    p.biology.proteins.join(" "),
    p.biology.receptors.join(" "),
    p.biology.channelsTransporters.join(" "),
    p.biology.cytokinesInterleukins.map((item) => `${item.name} ${item.effect} ${item.context}`).join(" ")
  ]
    .join(" ")
    .toLowerCase();
}

function filteredPeptides() {
  return DATA.peptides
    .filter((p) => {
      const matchesQuery = !state.query || searchable(p).includes(state.query.toLowerCase());
      const matchesCategory = state.category === "All" || p.category === state.category;
      const human = hasHumanStudies(p);
      const animal = hasAnimalStudies(p);
      const matchesStudy =
        state.studyFilter === "all" ||
        (state.studyFilter === "human" && human) ||
        (state.studyFilter === "animal" && animal) ||
        (state.studyFilter === "both" && human && animal);
      return matchesQuery && matchesCategory && matchesStudy;
    })
    .sort((a, b) => {
      if (state.sort === "random") return (RANDOM_ORDER.get(a.id) || 0) - (RANDOM_ORDER.get(b.id) || 0);
      if (state.sort === "name") return a.names.primary.localeCompare(b.names.primary);
      if (state.sort === "category") return a.category.localeCompare(b.category) || a.names.primary.localeCompare(b.names.primary);
      if (state.sort === "review") {
        return b.claims.filter((c) => c.needsModeratorReview).length - a.claims.filter((c) => c.needsModeratorReview).length;
      }
      const evidenceOrder = Object.keys(DATA.evidenceTierLabel);
      return (
        evidenceOrder.indexOf(a.classification.evidenceTier) - evidenceOrder.indexOf(b.classification.evidenceTier) ||
        a.names.primary.localeCompare(b.names.primary)
      );
    });
}

function resetToGridState() {
  state = {
    ...defaultState,
    lineFeature: state.lineFeature,
    scrollersOn: state.scrollersOn,
    brandAlt: state.brandAlt,
    notice: state.notice
  };
}

function syncHistory(view = "grid", mode = "auto") {
  if (typeof window === "undefined") return;
  const nextState = view === "detail" && state.selected ? { view: "detail", peptideId: state.selected.id } : { view: "grid" };
  const url = `${window.location.pathname}${window.location.search}${nextState.peptideId ? `#${encodeURIComponent(nextState.peptideId)}` : ""}`;
  if (history.state?.view === nextState.view && history.state?.peptideId === nextState.peptideId) return;
  const method = mode === "replace" ? "replaceState" : mode === "push" ? "pushState" : view === "detail" ? "pushState" : "replaceState";
  history[method](nextState, "", url);
}

function openDetail(peptideId, options = {}) {
  state.selected = DATA.peptides.find((p) => p.id === peptideId) || null;
  state.tag = null;
  state.structureZoom = null;
  state.bibliographyOpen = false;
  state.keySymbol = null;
  pendingDetailScrollTop = 0;
  syncHistory("detail", options.historyMode || "push");
  render();
}

function closeToGrid() {
  resetToGridState();
  syncHistory("grid");
  render();
}

function relatedPeptides() {
  if (!state.tag) return [];
  const target = norm(state.tag.value);
  const aliasTarget = norm(infoQueryForTag(state.tag));
  const targets = [...new Set([target, aliasTarget].filter(Boolean))];
  const tokens = [...new Set(targets.flatMap((value) => value.split(" ").filter((token) => token.length > 2)))];
  const rows = DATA.peptides
    .map((p) => {
      const matches = [];
      const blob = peptideTextBlob(p);
      if (state.tag.type === "effect") {
        p.tile.enhancingEffects.forEach((effect) => {
          const item = norm(effect.label);
          if (targets.some((value) => item.includes(value) || value.includes(item))) addMatch(matches, effect.label);
        });
        if (targets.some((value) => blob.includes(value))) addMatch(matches, "mechanism overlap");
        if (p.biology.cascades.some((chain) => targets.some((value) => norm(chain.category).includes(value)))) addMatch(matches, "pathway category overlap");
      }
      if (
        state.tag.type === "gene" &&
        p.biology.genes.some((gene) => targets.some((value) => norm(gene) === value || norm(gene).includes(value) || value.includes(norm(gene))))
      ) {
        addMatch(matches, state.tag.value);
      }
      if (
        state.tag.type === "protein" &&
        p.biology.proteins.some((protein) => targets.some((value) => norm(protein) === value || norm(protein).includes(value) || value.includes(norm(protein))))
      ) {
        addMatch(matches, state.tag.value);
      }
      if (
        state.tag.type === "protein" &&
        p.biology.receptors.some((receptor) => targets.some((value) => norm(receptor).includes(value) || value.includes(norm(receptor))))
      ) {
        addMatch(matches, `receptor-linked: ${state.tag.value}`);
      }
      if (
        state.tag.type === "cytokine" &&
        p.biology.cytokinesInterleukins.some((item) => targets.some((value) => norm(item.name) === value || norm(item.name).includes(value)))
      ) {
        addMatch(matches, state.tag.value);
      }
      if (
        state.tag.type === "channel" &&
        p.biology.channelsTransporters.some((channel) => targets.some((value) => norm(channel).includes(value) || value.includes(norm(channel))))
      ) {
        addMatch(matches, state.tag.value);
      }
      if (["gene", "protein", "cytokine", "channel"].includes(state.tag.type) && targets.some((value) => blob.includes(value))) {
        addMatch(matches, "pathway mention");
      }
      if (!matches.length && tokens.some((token) => token.length > 3 && blob.includes(token))) addMatch(matches, "text overlap");
      return { p, matches };
    })
    .filter((item) => item.matches.length || item.p.id === state.tag.sourcePeptideId)
    .sort((a, b) => {
      const aSource = a.p.id === state.tag.sourcePeptideId ? -1 : 0;
      const bSource = b.p.id === state.tag.sourcePeptideId ? -1 : 0;
      return aSource - bSource || b.matches.length - a.matches.length || a.p.names.primary.localeCompare(b.p.names.primary);
    });

  if (state.tag.sourcePeptideId && !rows.some((item) => item.p.id === state.tag.sourcePeptideId)) {
    const peptide = sourcePeptide();
    if (peptide) rows.unshift({ p: peptide, matches: ["source context"] });
  }
  return rows;
}

function infoQueryForTag(tagState) {
  const value = tagState?.value || "";
  const aliases = {
    AMPK: "AMP-activated protein kinase",
    "TNF-alpha": "Tumor necrosis factor",
    TNF: "Tumor necrosis factor",
    "IL-6": "Interleukin 6",
    "IL-1beta": "Interleukin 1 beta",
    VEGF: "Vascular endothelial growth factor",
    VEGFR1: "FLT1",
    VEGFR2: "KDR",
    AKT: "Protein kinase B",
    ERK1: "MAPK3",
    ERK2: "MAPK1",
    "NF-kB": "NF-kappa B",
    "NF-kappaB": "NF-kappa B",
    Nrf2: "NFE2L2",
    TGFbeta1: "Transforming growth factor beta 1",
    TGFb1: "Transforming growth factor beta 1",
    Smad2: "SMAD2",
    Smad3: "SMAD3",
    "MMP-9": "Matrix metallopeptidase 9",
    "TIMP-1": "TIMP1",
    "GLP-1R": "Glucagon-like peptide-1 receptor",
    GIPR: "Gastric inhibitory polypeptide receptor",
    GCGR: "Glucagon receptor",
    GHRHR: "Growth hormone-releasing hormone receptor",
    GHSR: "Growth hormone secretagogue receptor",
    CK2: "Casein kinase 2",
    APPL1: "APPL1",
    "PGC-1alpha": "PPARGC1A",
    eNOS: "NOS3",
    "COX-2": "PTGS2"
  };
  return aliases[value] || value;
}

function peptideTextBlob(p) {
  return norm(
    [
      p.tile.mechanismSummary,
      p.tile.localization,
      p.expanded.mechanismDetail,
      p.expanded.humanEvidence,
      p.expanded.animalEvidence,
      ...p.tile.clinicalUses,
      ...p.tile.sideEffects,
      ...p.biology.genes,
      ...p.biology.proteins,
      ...p.biology.receptors,
      ...p.biology.channelsTransporters,
      ...p.biology.cascades.flatMap((chain) => [chain.category, ...(chain.steps || [])]),
      ...p.biology.cytokinesInterleukins.map((item) => `${item.name} ${item.effect} ${item.context}`)
    ].join(" ")
  );
}

function sourcePeptide() {
  return state.tag?.sourcePeptideId ? DATA.peptides.find((p) => p.id === state.tag.sourcePeptideId) || null : null;
}

function addMatch(matches, label) {
  if (label && !matches.includes(label)) matches.push(label);
}

function cachedTagSummary(tagState, rows) {
  const cacheKey = `${tagState.type}:${tagState.value}`;
  if (tagSummaryCache.has(cacheKey)) return tagSummaryCache.get(cacheKey);
  const canonical = infoQueryForTag(tagState);
  const lead = {
    effect: `${tagState.value} is tracked here as a physiologic effect label rather than a single molecular target.`,
    gene: `${canonical} is tracked here as a gene-level node in peptide signaling and evidence summaries.`,
    protein: `${canonical} is tracked here as a protein or pathway node in the imported peptide data.`,
    cytokine: `${canonical} is tracked here as an immune or signaling mediator whose level or activity changes in peptide studies.`,
    channel: `${canonical} is tracked here as a channel or transporter node in the imported biology graph.`
  }[tagState.type] || `${canonical} is tracked here as an imported biology term.`;
  const peptides = rows.slice(0, 4).map((row) => row.p.names.primary);
  const associations = rows
    .slice(0, 3)
    .map((row) => `${row.p.names.primary}: ${row.matches.slice(0, 2).join(", ") || "source context"}`)
    .join("; ");
  const summary = {
    title: canonical,
    extract: `${lead} Related peptides in the current atlas include ${peptides.length ? peptides.join(", ") : "the current source peptide only"}. ${
      associations ? `Imported associations currently read as ${associations}.` : "More specific cross-peptide linkage is still being filled in as additional batches land."
    }`
  };
  tagSummaryCache.set(cacheKey, summary);
  return summary;
}

function tile(p) {
  const review = moderationLabel(p.moderation.status);
  const clinical = p.tile.clinicalUses[0] || "Clinical use context not yet verified.";
  const enhancement = p.expanded.anecdotalUse[0] || "No enhancement/common-use statement imported.";
  const risk = p.tile.sideEffects[0] || p.expanded.safetyDetail || "Key risk context pending extraction.";
  const classColor = categoryColor(p.category);
  const evidenceTags = tileEvidenceTags(p);
  return `<article class="tile" style="--type-color:${esc(classColor)};--type-rgb:${hexToRgb(classColor)}" data-expand="${esc(p.id)}" data-peptide-id="${esc(p.id)}" tabindex="0" aria-label="Open ${esc(p.names.primary)} article">
    <header>
      <div>
        <p class="eyebrow category-label">${esc(p.category)}</p>
        <h2 class="name-display">${formatPeptideName(p.names.primary)}</h2>
        ${
          evidenceTags.length
            ? `<div class="tile-evidence-tags">${evidenceTags
                .map((tag) => `<span class="${esc(tag.kind)}">${esc(tag.label)}</span>`)
                .join("")}</div>`
            : ""
        }
      </div>
      <button class="verify ${p.moderation.status === "verified" ? "ok" : "pending"}" data-open-key="review" title="${esc(review)}" aria-label="${esc(
        review
      )}"></button>
    </header>
    ${tileStructurePreview(p)}
    <p class="mechanism">${esc(p.tile.mechanismSummary)} ${p.citations.slice(0, 2).map(citationLink).join("")}</p>
    <dl class="quick">
      <div><dt>Medical / Clinical</dt><dd>${esc(clinical)}</dd></div>
      <div><dt>Enhancement / Common Use</dt><dd>${esc(enhancement)}</dd></div>
      <div><dt>Key Risks</dt><dd>${esc(risk)}</dd></div>
    </dl>
    <section class="effects">${p.tile.enhancingEffects.slice(0, 4).map((effect) => tag("effect", effect.label, effect.symbols, p.id)).join("")}</section>
    <section class="chips">${p.biology.proteins.slice(0, 5).map((protein) => tag("protein", protein, [], p.id)).join("")}</section>
  </article>`;
}

function stepRole(index, total) {
  if (index === 0) return "upstream trigger";
  if (index === total - 1) return "distal outcome";
  if (index === 1) return "primary transducer";
  if (index === total - 2) return "physiologic integration";
  return "intermediate node";
}

function describeStep(chain, step, index, total) {
  const role = stepRole(index, total);
  const normalized = String(step || "").toLowerCase();
  if (normalized.includes("bind") || normalized.includes("agon") || normalized.includes("partitions")) {
    return `${role}: ligand, receptor, or membrane engagement that initiates the pathway.`;
  }
  if (normalized.includes("camp") || normalized.includes("pka") || normalized.includes("epac") || normalized.includes("erk") || normalized.includes("akt") || normalized.includes("smad") || normalized.includes("nf-kb") || normalized.includes("nrf2")) {
    return `${role}: intracellular signaling node that shifts transcriptional, inflammatory, or metabolic state.`;
  }
  if (normalized.includes("transcription") || normalized.includes("gene") || normalized.includes("expression") || normalized.includes("biogenesis")) {
    return `${role}: transcriptional or program-level shift that changes phenotype over time.`;
  }
  if (normalized.includes("insulin") || normalized.includes("glucagon") || normalized.includes("gastric emptying") || normalized.includes("satiety") || normalized.includes("lipolysis") || normalized.includes("glucose")) {
    return `${role}: integrated physiologic effect linking signaling to organ-level metabolic behavior.`;
  }
  if (normalized.includes("weight") || normalized.includes("hba1c") || normalized.includes("repair") || normalized.includes("fibrosis") || normalized.includes("exercise") || normalized.includes("wound")) {
    return `${role}: tissue or clinical endpoint associated with the upstream cascade.`;
  }
  return `${role}: extracted ${chain.category} step in the current pathway map.`;
}

function pathwayNarrative(chain) {
  const category = String(chain.category || "").toLowerCase();
  const steps = chain.steps || [];
  if (category.includes("islet") || category.includes("gh axis") || category.includes("tri-agonist") || category.includes("incretin")) {
    return `This pathway is organized around receptor engagement at the endocrine control point, then second-messenger amplification, then hormone-output and substrate-handling consequences. In the current record, the extracted nodes indicate directionality from receptor agonism toward changed insulin, glucagon, GH, IGF-1, or energy-balance physiology rather than a vague “metabolic support” claim.`;
  }
  if (category.includes("satiety") || category.includes("appetite") || category.includes("gastric")) {
    return `This chain maps the CNS and gastrointestinal control arm of the peptide. The upstream nodes alter meal salience or gastric-emptying kinetics first, and the weight or intake phenotype appears downstream as an integrated behavioral and autonomic consequence.`;
  }
  if (category.includes("mitochond") || category.includes("energetic")) {
    return `This cascade is mitochondrial rather than receptor-surface biology. The extracted sequence moves from membrane or transporter behavior to altered oxidative-phosphorylation handling, then to energetic efficiency and finally to tissue-level function under stressed conditions.`;
  }
  if (category.includes("angiogenesis") || category.includes("repair") || category.includes("matrix") || category.includes("wound")) {
    return `This is a tissue-repair cascade: endothelial or stromal signals shift first, migration / remodeling programs change next, and the visible wound-healing or repair phenotype appears at the end of the chain. The imported record supports biologic plausibility here more strongly than direct human efficacy.`;
  }
  if (category.includes("inflammatory") || category.includes("immune") || category.includes("anti-fibrotic")) {
    return `This pathway centers on inflammatory tone. The sequence starts at cytokine, transcription-factor, or oxidative-stress nodes, then moves toward remodeling, immune-state, or fibrosis endpoints; each downstream effect should still be read in the original disease or experimental context.`;
  }
  return `This pathway begins at ${steps[0] || "the extracted upstream node"}, propagates through ${steps.slice(1, -1).join(", ") || "intermediate signaling nodes"}, and ends at ${steps[steps.length - 1] || "the current distal phenotype"}. The intended reading is mechanistic directionality from proximal trigger to distal tissue or clinical consequence.`;
}

function inferDirection(text) {
  const value = norm(text);
  if (/(downreg|decreas|lower|reduc|suppress|inhibit|attenuat|blunt)/.test(value)) return "decrease / inhibition";
  if (/(upreg|increas|rais|enhanc|activat|stimul|augment|promot|induc|secret|release)/.test(value)) return "increase / activation";
  if (/(stabiliz|preserv|maintain|support)/.test(value)) return "stabilization / preservation";
  return "direction not fully extracted";
}

function extractPathwayRows(p, chain) {
  const entities = [
    ...p.biology.proteins,
    ...p.biology.receptors,
    ...p.biology.channelsTransporters,
    ...p.biology.genes,
    ...p.biology.cytokinesInterleukins.map((item) => item.name)
  ].filter(Boolean);
  const dedupedEntities = [...new Set(entities)];
  const rows = [];
  const seen = new Set();

  chain.steps.forEach((step, index) => {
    const next = chain.steps[index + 1] || "";
    const hits = dedupedEntities.filter((item) => norm(step).includes(norm(item)) || norm(next).includes(norm(item))).slice(0, 4);
    const direction = inferDirection(`${step} ${next}`);
    const downstream = chain.steps.slice(index + 1, index + 3).join(" -> ") || chain.steps[chain.steps.length - 1] || "downstream effect pending extraction";
    const candidates = hits.length ? hits : [step];

    candidates.forEach((node) => {
      const key = `${node}__${direction}__${downstream}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({
        node,
        direction,
        downstream
      });
    });
  });

  if (!rows.length) {
    const fallback = chain.steps.slice(0, -1).map((step, index) => ({
      node: step,
      direction: inferDirection(`${step} ${chain.steps[index + 1] || ""}`),
      downstream: chain.steps[index + 1] || "downstream effect pending extraction"
    }));
    return fallback;
  }

  return rows;
}

function signalingSection(p, define = (text) => String(text || "")) {
  const chains = p.biology.cascades.length
    ? p.biology.cascades
    : [{ category: "mechanism", steps: [p.classification.peptideClass, p.classification.mechanismFamily, "clinical effect requires extraction"], symbols: ["?"] }];
  const summarySteps = chains[0]?.steps || [p.names.primary, p.classification.mechanismFamily, "effect context pending"];
  return `<section class="article-section">
    <h3>Physiological Pathways</h3>
    <p class="section-note">${esc(cleanNarrativeText(p, p.expanded.mechanismDetail, define))}</p>
    <div class="pathway-summary">
      <p class="eyebrow">summary mechanism ${symbols(chains[0]?.symbols || ["?"])}</p>
      <div class="signal-chain compact">
              ${summarySteps
                .map(
                  (step, index) =>
                    `${index ? '<span class="signal-arrow">-></span>' : ""}<span class="signal-node"><i class="signal-step-index">${index + 1}</i><span>${esc(define(step))}</span></span>`
                )
                .join("")}
      </div>
    </div>
    <div class="signal-grid">
      ${chains
        .map(
          (chain) => {
            const claim = p.claims.find((item) => item.id === chain.claimRef);
            const description = pathwayNarrative(chain);
            return `<article class="pathway-card">
            <div class="pathway-card-head">
              <div>
                <p class="eyebrow">${esc(chain.category)} ${symbols(chain.symbols)}</p>
                <h4>${esc(chain.category)}</h4>
              </div>
              <div class="pathway-cites">${claim ? citationRefsByIds(p, claim.citationIds) : ""}</div>
            </div>
            <p class="pathway-description">${esc(define(description))}</p>
            <div class="signal-chain">
              ${chain.steps
                .map(
                  (step, index) =>
                    `${index ? '<span class="signal-arrow">-></span>' : ""}<span class="signal-node"><i class="signal-step-index">${index + 1}</i><span>${esc(define(step))}</span></span>`
                )
                .join("")}
            </div>
            <table class="pathway-table">
              <thead><tr><th>Stage</th><th>Node</th><th>Functional note</th></tr></thead>
              <tbody>${chain.steps
                .map(
                  (step, index) => `<tr>
                    <td>${esc(stepRole(index, chain.steps.length))}</td>
                    <td>${esc(define(step))}</td>
                    <td>${esc(define(describeStep(chain, step, index, chain.steps.length)))}</td>
                  </tr>`
                )
                .join("")}</tbody>
            </table>
            <table class="pathway-table pathway-reg-table">
              <thead><tr><th>Protein / enzyme / node</th><th>Direction</th><th>Downstream effect</th></tr></thead>
              <tbody>${extractPathwayRows(p, chain)
                .map(
                  (row) => `<tr>
                    <td>${esc(define(row.node))}</td>
                    <td>${esc(row.direction)}</td>
                    <td>${esc(define(row.downstream))}</td>
                  </tr>`
                )
                .join("")}</tbody>
            </table>
          </article>`;
          }
        )
        .join("")}
    </div>
  </section>`;
}

function studyRows(p, speciesGroup, define = (text) => String(text || "")) {
  const claimSpecies = speciesGroup === "human" ? ["human", "mixed"] : ["animal", "mixed"];
  const rows = [];
  p.claims
    .filter((claim) => claimSpecies.includes(claim.species))
    .forEach((claim) => {
      const citations = claim.citationIds
        .map((id) => p.citations.find((citation) => citation.id === id))
        .filter(Boolean);
      citations.forEach((citation) => {
        rows.push({ claim, citation });
      });
    });

  if (!rows.length) {
    return `<tr><td colspan="5">No ${speciesGroup} study rows extracted yet. This absence means curation is pending, not that evidence is absent.</td></tr>`;
  }

  return rows
    .map(({ claim, citation }) => {
      const population = claim.population || (speciesGroup === "human" ? "Human population details pending extraction." : "Animal model details pending extraction.");
      const protocol = [claim.context.replaceAll("_", " "), claim.route, claim.duration].filter(Boolean).join("; ") || "Protocol pending extraction.";
      return `<tr>
        <td><a class="study-link" href="${esc(citation.url)}" target="_blank" rel="noreferrer">${esc(citation.title)}</a><br><span class="muted">Retrieved ${esc(citation.accessedAt || "date pending")}</span></td>
        <td>${esc(define(population))}</td>
        <td>${esc(claim.sampleSize || "n pending extraction")}</td>
        <td>${esc(define(protocol))}</td>
        <td>${esc(define(claim.value))} ${symbols(claim.symbols)}</td>
      </tr>`;
    })
    .join("");
}

function evidenceTables(p, define = (text) => String(text || "")) {
  return `<section class="article-section">
    <h3>Supporting Studies</h3>
    <h4>Human Studies</h4>
    <table>
      <thead><tr><th>Study</th><th>Population</th><th>n</th><th>Protocol</th><th>Notable results, stated narrowly</th></tr></thead>
      <tbody>${studyRows(p, "human", define)}</tbody>
    </table>
    <h4>Animal / Preclinical Studies</h4>
    <table>
      <thead><tr><th>Study</th><th>Population / model</th><th>n</th><th>Protocol</th><th>Notable results, stated narrowly</th></tr></thead>
      <tbody>${studyRows(p, "animal", define)}</tbody>
    </table>
    <h4>Anecdotal / Common-Use Reports</h4>
    <table>
      <thead><tr><th>Claim type</th><th>Display rule</th><th>Current text</th></tr></thead>
      <tbody><tr><td>Non-peer-reviewed / common-use</td><td>Never displayed as efficacy or safety evidence.</td><td>${esc(
        define(p.expanded.anecdotalUse.length ? p.expanded.anecdotalUse.join(" ") : "No anecdotal/common-use statement imported.")
      )}</td></tr></tbody>
    </table>
  </section>`;
}

function safetyPanel(p, define = (text) => String(text || "")) {
  const rows = p.expanded.safetyRisks || [];
  return `<section class="article-section">
    <h3>Safety Risks</h3>
    <p class="section-note">${esc(define(p.expanded.safetyDetail))}</p>
    <table>
      <thead><tr><th>Organ system</th><th>Potential help</th><th>Potential harm</th></tr></thead>
      <tbody>${
        rows.length
          ? rows
              .map(
                (row) => `<tr>
                  <td><span class="organ-pill" style="--organ-color:${esc(row.color)}"><span class="organ-dot"></span>${esc(row.label)}</span></td>
                  <td>${esc(define(row.helpSummary || "No organ-specific benefit extracted."))} ${citationRefsByIds(p, row.citationIds)}</td>
                  <td>${esc(define(row.harmSummary || "No organ-specific harm extracted."))} ${citationRefsByIds(p, row.citationIds)}</td>
                </tr>`
              )
              .join("")
          : '<tr><td colspan="3">Organ-specific safety curation is still pending for this peptide.</td></tr>'
      }</tbody>
    </table>
  </section>`;
}

function enhancementPanel(p, define = (text) => String(text || "")) {
  const item = p.expanded.enhancementPotential;
  return `<section class="article-section">
    <h3>Enhancement Potential</h3>
    <table>
      <tbody>${
        item
          ? `<tr><th>Overview</th><td>${esc(define(item.summary))} ${citationRefsByIds(p, item.citationIds)}</td></tr>
             <tr><th>Caveat</th><td>${esc(define(item.caveat))}</td></tr>`
          : `<tr><th>Overview</th><td>${esc(
              define(p.expanded.anecdotalUse.length
                ? p.expanded.anecdotalUse.join(" ")
                : "No enhancement-specific curation has been extracted yet.")
            )}</td></tr>`
      }</tbody>
    </table>
  </section>`;
}

function bibliographyDrawer() {
  if (!state.bibliographyOpen) return "";
  return `<section class="bibliography-backdrop" data-close-bibliography>
    <aside class="bibliography-drawer" aria-label="Bibliography">
      <header>
        <div>
          <p class="eyebrow">Bibliography</p>
          <h3>All References</h3>
        </div>
        <button class="icon" data-close-bibliography-button aria-label="Close bibliography">x</button>
      </header>
      <table>
        <thead><tr><th>Ref</th><th>Source</th><th>Type</th><th>Retrieved</th></tr></thead>
        <tbody>${citationRegistry.citations.map(
          (citation) => `<tr>
            <td>[${citationNumber(citation)}]</td>
            <td><a class="table-link" href="${esc(citation.url)}" target="_blank" rel="noreferrer">${esc(citation.title)}</a><br><span class="muted">${esc((citation.authors || []).join(", "))}</span></td>
            <td>${esc(citation.quality)}</td>
            <td>${esc(citation.accessedAt || "date pending")}</td>
          </tr>`
        ).join("")}</tbody>
      </table>
    </aside>
  </section>`;
}

function noticeToast() {
  if (!state.notice) return "";
  return `<div class="notice-toast" role="status" aria-live="polite">${esc(state.notice)}</div>`;
}

function structureModal() {
  if (!state.structureZoom) return "";
  return `<section class="image-backdrop" data-close-structure-modal>
    <aside class="image-modal" aria-label="${esc(state.structureZoom.name)} structure image">
      <header class="modal-head">
        <div>
          <p class="eyebrow">structure</p>
          <h3>${esc(state.structureZoom.name)}</h3>
        </div>
        <button class="icon modal-close" data-close-structure-button aria-label="Close structure image">x</button>
      </header>
      <div class="image-modal-frame">
        <img src="/structures/${esc(state.structureZoom.id)}.png" alt="${esc(state.structureZoom.name)} enlarged structure">
      </div>
    </aside>
  </section>`;
}

function keyModalContent(token) {
  if (token === "review") {
    return {
      title: "Verification status",
      body: `<div class="key-grid">
        <div class="key-row"><span class="verify pending"></span><div><strong>Yellow dot</strong><p>Model-drafted or pending human/mod verification.</p></div></div>
        <div class="key-row"><span class="verify ok"></span><div><strong>Green dot</strong><p>A moderator has verified the article or claim set.</p></div></div>
      </div>`
    };
  }

  if (DATA.evidenceLegend[token]) {
    return {
      title: "Evidence symbol",
      body: `<div class="key-grid">
        ${Object.entries(DATA.evidenceLegend)
          .map(
            ([key, value]) => `<button class="key-row ${key === token ? "active" : ""}" type="button" data-open-key="${esc(key)}">
              <span class="key-icon"><span class="symbol-button inert">${symbolGlyph(key)}</span></span>
              <div><p>${esc(value)}</p></div>
            </button>`
          )
          .join("")}
        <div class="key-row"><span class="verify pending"></span><div><strong>Yellow dot</strong><p>Model-drafted or pending human/mod verification.</p></div></div>
        <div class="key-row"><span class="verify ok"></span><div><strong>Green dot</strong><p>A moderator has verified the article or claim set.</p></div></div>
      </div>`
    };
  }

  if (token.startsWith("tier:")) {
    const tier = token.slice(5);
    return {
      title: DATA.evidenceTierLabel[tier] || "Evidence tier",
      body: `<div class="key-grid"><div class="key-row active"><div><strong>${esc(DATA.evidenceTierLabel[tier] || tier)}</strong><p>${esc(
        evidenceTierExplanation(tier)
      )}</p></div></div></div>`
    };
  }

  if (token.startsWith("regulatory:")) {
    const status = token.slice(11);
    return {
      title: "Regulatory status",
      body: `<div class="key-grid"><div class="key-row active"><div><strong>${esc(status.replaceAll("_", " "))}</strong><p>${esc(
        regulatoryLabel(status)
      )}</p></div></div></div>`
    };
  }

  if (token.startsWith("dosing:")) {
    const context = token.slice(7);
    return {
      title: "Dosing context",
      body: `<div class="key-grid"><div class="key-row active"><div><strong>${esc(context.replaceAll("_", " "))}</strong><p>${esc(
        dosingContextLabel(context)
      )}</p></div></div></div>`
    };
  }

  if (token.startsWith("moderation:")) {
    const status = token.slice(11);
    return {
      title: "Moderator status",
      body: `<div class="key-grid"><div class="key-row active"><div><strong>${esc(moderationLabel(status))}</strong><p>${esc(
        moderationExplanation(status)
      )}</p></div></div></div>`
    };
  }

  return {
    title: "Key",
    body: `<div class="key-grid"><div class="key-row active"><div><p>No additional key text is available for this item yet.</p></div></div></div>`
  };
}

function keyModal() {
  if (!state.keySymbol) return "";
  const content = keyModalContent(state.keySymbol);
  return `<section class="key-backdrop" data-close-key-modal>
    <aside class="key-modal" aria-label="Evidence key">
      <header>
        <div>
          <p class="eyebrow">key</p>
          <h3>${esc(content.title)}</h3>
        </div>
        <button class="icon" data-close-key-button aria-label="Close key">x</button>
      </header>
      ${content.body}
    </aside>
  </section>`;
}

function relatedPanel() {
  if (!state.tag) return "";
  const rows = relatedPeptides();
  const summary = cachedTagSummary(state.tag, rows);
  return `<section class="related-backdrop" data-close-related-modal>
    <aside class="related-modal" aria-label="${esc(state.tag.value)} overview">
    <header class="modal-head">
      <div>
        <p class="eyebrow">${esc(state.tag.type)} overview</p>
        <h3>${esc(state.tag.value)}</h3>
      </div>
      <button class="icon modal-close" data-clear-related aria-label="Close related overview">x</button>
    </header>
    <section class="related-summary">
      <p>${esc(summary.extract)}</p>
    </section>
    <section class="related-summary">
      <h4>Associated peptides</h4>
    <table>
      <thead><tr><th>Peptide</th><th>Evidence</th><th>Association</th><th>Brief mechanism</th><th>Key effects</th></tr></thead>
      <tbody>${
        rows.length
          ? rows
              .map(
                (item) => `<tr>
                  <td><button class="inline-link" data-expand="${esc(item.p.id)}">${esc(item.p.names.primary)}</button></td>
                  <td>${esc(DATA.evidenceTierLabel[item.p.classification.evidenceTier])}</td>
                  <td>${esc(item.matches.join(", "))}</td>
                  <td>${esc(item.p.tile.mechanismSummary)}</td>
                  <td>${esc(item.p.tile.enhancingEffects.slice(0, 3).map((effect) => effect.label).join(", ") || "none listed")}</td>
                </tr>`
              )
              .join("")
          : ""
      }</tbody>
    </table>
    </section>
  </aside>
  </section>`;
}

function structurePanel(p) {
  return `<div class="structure-panel">
    <button class="structure-button" type="button" data-open-structure="${esc(p.id)}" aria-label="Enlarge ${esc(p.names.primary)} structure">
      <img src="/structures/${esc(p.id)}.png" alt="${esc(p.names.primary)} structure" loading="lazy" onerror="this.parentElement.remove()">
    </button>
  </div>`;
}

function chemicalIdentityPanel(p) {
  const properties = p.identity?.properties || {};
  return `<section class="identity-panel">
    <h3>Chemical Identity</h3>
    <dl class="identity-grid">
      <dt>Chemical names / aliases</dt><dd>${esc(p.names.aliases.join(" / ") || "No alternate chemical names imported.")}</dd>
      <dt>Trade names</dt><dd>${esc(p.names.tradeNames.join(" / ") || "No trade names imported.")}</dd>
      <dt>Formula</dt><dd>${esc(p.identity.formula || "Formula pending extraction.")}</dd>
      <dt>One-letter sequence</dt><dd>${esc(p.identity.sequenceOneLetter || "Sequence pending extraction.")}</dd>
      <dt>Three-letter sequence</dt><dd>${esc(p.identity.sequenceThreeLetter || "Sequence pending extraction.")}</dd>
      <dt>Half-life</dt><dd>${identityValueWithCitations(p, properties.halfLife, "Half-life pending extraction.")}</dd>
      <dt>Administration / injection route</dt><dd>${identityValueWithCitations(p, properties.administration, "Administration route pending extraction.")}</dd>
      <dt>pKa</dt><dd>${identityValueWithCitations(p, properties.pKa, "pKa data not standardized in the current record.")}</dd>
      <dt>Polarity</dt><dd>${identityValueWithCitations(p, properties.polarity, "Polarity descriptor pending extraction.")}</dd>
      <dt>Hydrophobicity</dt><dd>${identityValueWithCitations(p, properties.hydrophobicity, "Hydrophobicity descriptor pending extraction.")}</dd>
      <dt>Lipophilicity</dt><dd>${identityValueWithCitations(p, properties.lipophilicity, "Lipophilicity descriptor pending extraction.")}</dd>
      <dt>Water solubility</dt><dd>${identityValueWithCitations(p, properties.waterSolubility, "Water-compatibility estimate pending extraction.")}</dd>
    </dl>
  </section>`;
}

function criticalEffectsPanel(p, define = (text) => String(text || "")) {
  const effects = p.tile.enhancingEffects.slice(0, 4).map((effect) => effect.label);
  const bullets = effects.length
    ? effects
    : [
        p.tile.clinicalUses[0] || p.tile.mechanismSummary,
        p.tile.sideEffects[0] || p.expanded.safetyDetail
      ].filter(Boolean).slice(0, 3);
  return `<section class="critical-effects-box">
    <p class="eyebrow">Key Known Effects</p>
    <ul>${bullets.map((item) => `<li>${esc(define(item))}</li>`).join("")}</ul>
  </section>`;
}

function detail(p) {
  if (!p) return "";
  const define = createDefinitionExpander();
  const humanText = cleanNarrativeText(p, p.expanded.humanEvidence, define);
  const animalText = cleanNarrativeText(p, p.expanded.animalEvidence, define);
  const mechanismText = cleanNarrativeText(p, p.expanded.mechanismDetail, define);
  const safetyText = cleanNarrativeText(p, p.expanded.safetyDetail, define);
  return `<section class="detail-backdrop" data-close-detail>
    <article class="detail" data-peptide-id="${esc(p.id)}" role="dialog" aria-modal="true" aria-label="${esc(p.names.primary)} detail">
      <div class="article-shell">
        <header class="article-head">
          <div>
            <p class="eyebrow">${esc(p.category)} / ${esc(moderationLabel(p.moderation.status))}</p>
            <h2 class="name-display">${formatPeptideName(p.names.primary)}</h2>
            <p>${esc(p.names.aliases.join(" / ") || p.classification.peptideClass)}</p>
          </div>
          <div class="article-head-actions">
            <button class="header-button" data-share-link="${esc(p.id)}" aria-label="Share link to ${esc(p.names.primary)}">Share</button>
            <button class="header-button" data-copy-link="${esc(p.id)}" aria-label="Copy link to ${esc(p.names.primary)}">Copy link</button>
            <button class="icon" data-close aria-label="Close article">x</button>
          </div>
        </header>
        <section class="article-section intro">
          <div>
            <p><span class="label-mono">MECHANISM:</span> ${esc(define(p.tile.mechanismSummary))}</p>
            <p><span class="label-mono">LOCALIZATION:</span> ${esc(define(p.tile.localization))}</p>
            <p><span class="label-mono">CLINICAL CONTEXT:</span> ${esc(define(p.tile.clinicalUses.join(" ")))}</p>
            ${criticalEffectsPanel(p, define)}
            ${chemicalIdentityPanel(p)}
          </div>
          <aside>
            ${structurePanel(p)}
            <div class="status-pill-row">
              <button class="evidence-badge ${evidenceClass(p.classification.evidenceTier)} key-chip" type="button" data-open-key="tier:${esc(
                p.classification.evidenceTier
              )}">${esc(DATA.evidenceTierLabel[p.classification.evidenceTier])}</button>
              <button class="status-pill key-chip" type="button" data-open-key="regulatory:${esc(p.classification.regulatoryStatus)}">${esc(
                p.classification.regulatoryStatus.replaceAll("_", " ")
              )}</button>
              <button class="status-pill key-chip" type="button" data-open-key="dosing:${esc(p.tile.dosing.context)}">dosing: ${esc(
                p.tile.dosing.context.replaceAll("_", " ")
              )}</button>
              <button class="status-pill key-chip" type="button" data-open-key="moderation:${esc(p.moderation.status)}">${esc(
                moderationLabel(p.moderation.status)
              )}</button>
            </div>
          </aside>
        </section>
        ${signalingSection(p, define)}
        <section class="article-section">
          <h3>Clinical And Enhancement Use</h3>
          <table>
            <tbody>
              <tr><th>Medical / clinical use</th><td>${esc(define(p.tile.clinicalUses.join(" ")))}</td></tr>
              <tr><th>Enhancement / common-use context</th><td>${esc(
                define(p.expanded.anecdotalUse.length ? p.expanded.anecdotalUse.join(" ") : "No enhancement/common-use statement imported.")
              )}</td></tr>
              <tr><th>Dosing context</th><td>${esc(define(`${p.tile.dosing.quick} ${p.tile.dosing.adminRoute}`))}</td></tr>
              <tr><th>Safety</th><td>${esc(define(`${safetyText} ${p.tile.sideEffects.join(" ")}`))}</td></tr>
            </tbody>
          </table>
        </section>
        ${safetyPanel(p, define)}
        ${enhancementPanel(p, define)}
        <section class="article-section">
          <h3>Evidence And Article Notes</h3>
          <table>
            <tbody>
              <tr><th>Human evidence</th><td>${esc(humanText)} ${citationRefsByIds(p, sectionCitationIds(p, "human"))}</td></tr>
              <tr><th>Animal evidence</th><td>${esc(animalText)} ${citationRefsByIds(p, sectionCitationIds(p, "animal"))}</td></tr>
              <tr><th>Mechanism detail</th><td>${esc(mechanismText)} ${citationRefsByIds(p, sectionCitationIds(p, "mechanism"))}</td></tr>
              <tr><th>Missing evidence</th><td>${esc(define(p.expanded.missingEvidence.join("; ") || "No missing-evidence list yet."))}</td></tr>
            </tbody>
          </table>
        </section>
        <section class="article-section">
          <h3>Interactable Biology</h3>
          <div class="tag-groups">
            <div class="tag-block"><h4>Effects</h4><div class="tag-flow">${p.tile.enhancingEffects.map((effect) => tag("effect", effect.label, effect.symbols, p.id, define(effect.label))).join("") || '<span class="muted">Pending extraction</span>'}</div></div>
            <div class="tag-block"><h4>Genes</h4><div class="tag-flow">${p.biology.genes.map((gene) => tag("gene", gene, [], p.id, define(gene))).join("") || '<span class="muted">Pending extraction</span>'}</div></div>
            <div class="tag-block"><h4>Proteins</h4><div class="tag-flow">${p.biology.proteins.map((protein) => tag("protein", protein, [], p.id, define(protein))).join("") || '<span class="muted">Pending extraction</span>'}</div></div>
            <div class="tag-block"><h4>Channels</h4><div class="tag-flow">${p.biology.channelsTransporters.map((channel) => tag("channel", channel, [], p.id, define(channel))).join("") || '<span class="muted">Pending extraction</span>'}</div></div>
          </div>
        </section>
        <section class="article-section">
          <h3>Cytokines, Interleukins, And Markers</h3>
          <table>
            <thead><tr><th>Marker</th><th>Effect</th><th>Context</th><th>Basis</th></tr></thead>
            <tbody>${
              p.biology.cytokinesInterleukins.length
                ? p.biology.cytokinesInterleukins
                    .map(
                      (item) => `<tr>
                        <td>${tag("cytokine", item.name, item.symbols, p.id, define(item.name))}</td>
                        <td>${esc(define(item.effect))}</td>
                        <td>${esc(define(item.context))}</td>
                        <td>${symbols(item.symbols)}</td>
                      </tr>`
                    )
                    .join("")
                : '<tr><td colspan="4">No sourced cytokine/interleukin entries yet.</td></tr>'
            }</tbody>
          </table>
        </section>
        ${evidenceTables(p, define)}
        <section class="article-section">
          <h3>Manufacturers, Vendor Data, And Cost</h3>
          <table>
            <thead><tr><th>Vendor</th><th>Grade / score</th><th>Tests</th><th>Product</th><th>Lab / source</th><th>Notes</th></tr></thead>
            <tbody>${
              p.vendorData.length
                ? p.vendorData
                    .map(
                      (v) => `<tr>
                        <td>${esc(v.vendor)}</td>
                        <td>${esc([v.ratingGrade, v.ratingScore != null ? `${v.ratingScore}/10` : null].filter(Boolean).join(" / ") || "not imported")}</td>
                        <td>${esc(v.testCount != null ? `${v.testCount} tests; ${v.oldestTest || "date?"} to ${v.latestTest || "date?"}` : "not imported")}</td>
                        <td>${v.productUrl ? `<a class="vendor-link" href="${esc(v.productUrl)}" target="_blank" rel="noreferrer">${esc(`${v.productName} ${v.vialSize || ""}`)}</a>` : esc(`${v.productName} ${v.vialSize || ""}`)}</td>
                        <td>${v.coaUrl ? `<a class="vendor-link" href="${esc(v.coaUrl)}" target="_blank" rel="noreferrer">${esc(v.lab || v.sourcePlatform || "vendor source")}</a>` : esc(v.lab || v.sourcePlatform || "not imported")}</td>
                        <td>${esc(v.notes || v.priceRange || "price and per-batch COA detail pending later passes")}</td>
                      </tr>`
                    )
                    .join("")
                : '<tr><td colspan="6">No vendor rows imported.</td></tr>'
            }</tbody>
          </table>
        </section>
        <section class="article-section">
          <h3>Moderator Verification</h3>
          <table>
            <tbody>
              <tr><th>Status</th><td>${esc(moderationLabel(p.moderation.status))}</td></tr>
              <tr><th>Reviewer</th><td>${esc(p.moderation.reviewer || "No human moderator assigned yet.")}</td></tr>
              <tr><th>Write-up</th><td>${esc(p.moderation.verificationWriteup || "Future mod class can verify citations, add a structured write-up, and leave rationale for other mods.")}</td></tr>
              <tr><th>Stale after</th><td>${esc(p.moderation.staleAfter || "not set")}</td></tr>
            </tbody>
          </table>
        </section>
        <section class="article-section citations-section">
          <h3>Citations</h3>
          <table>
            <thead><tr><th>Ref</th><th>Source</th><th>Type</th><th>Date retrieved</th><th>Notes</th></tr></thead>
            <tbody>${p.citations
              .map(
                (citation) => `<tr>
                  <td>${citationLink(citation)}</td>
                  <td><a class="table-link" href="${esc(citation.url)}" target="_blank" rel="noreferrer">${esc(citation.title)}</a></td>
                  <td>${esc(citation.quality)}</td>
                  <td>${esc(citation.accessedAt || "date pending")}</td>
                  <td>${esc(citation.notes)}</td>
                </tr>`
              )
              .join("")}</tbody>
          </table>
        </section>
      </div>
    </article>
  </section>`;
}

function hero() {
  return `<section class="hero">
    <div>
      <button class="brand-title-button ${state.brandAlt ? "active" : ""}" type="button" data-toggle-brand-mode aria-pressed="${
        state.brandAlt ? "true" : "false"
      }" aria-label="Toggle hidden structure mode">
        <h1 class="brand-title">${BRAND}</h1>
      </button>
    </div>
  </section>`;
}

function sideRail(direction) {
  const glyphs = "PEPTIDE SIGNALING ATLAS ".split("");
  const repeated = Array.from({ length: 4 }, () => glyphs)
    .flat()
    .map((char) => `<span>${esc(char === " " ? " " : char)}</span>`)
    .join("");
  return `<div class="side-rail side-rail-${esc(direction)}" aria-hidden="true">
    <div class="side-rail-track">${repeated}</div>
  </div>`;
}

function atlasFrameOpen() {
  return `<section class="atlas-frame">
    ${state.scrollersOn ? `${sideRail("left")}${sideRail("right")}` : ""}`;
}

function atlasFrameClose() {
  return `</section>`;
}

function toolbar(categories) {
  return `<section class="toolbar">
    <input data-search data-focus-key="search" value="${esc(state.query)}" placeholder="Search names, genes, proteins, effects, cytokines">
    <select data-category data-focus-key="category">
      ${categories
        .map(
          (category) =>
            `<option value="${esc(category)}" ${category === state.category ? "selected" : ""}>${esc(
              category === "All" ? "All Peptides" : category
            )}</option>`
        )
        .join("")}
    </select>
    <select data-sort data-focus-key="sort">
      <option value="random" ${state.sort === "random" ? "selected" : ""}>Randomized</option>
      <option value="evidence" ${state.sort === "evidence" ? "selected" : ""}>Evidence strength</option>
      <option value="name" ${state.sort === "name" ? "selected" : ""}>Name A-Z</option>
      <option value="category" ${state.sort === "category" ? "selected" : ""}>Category</option>
      <option value="review" ${state.sort === "review" ? "selected" : ""}>Needs review</option>
    </select>
    <select data-study-filter data-focus-key="study-filter">
      <option value="all" ${state.studyFilter === "all" ? "selected" : ""}>All Studies</option>
      <option value="human" ${state.studyFilter === "human" ? "selected" : ""}>Human only</option>
      <option value="animal" ${state.studyFilter === "animal" ? "selected" : ""}>Animal only</option>
      <option value="both" ${state.studyFilter === "both" ? "selected" : ""}>Human + animal</option>
    </select>
    <button class="bibliography-button ${state.lineFeature ? "active" : ""}" data-toggle-line aria-pressed="${state.lineFeature ? "true" : "false"}" aria-label="Toggle line feature">
      ${state.lineFeature ? "Line On" : "Line Off"}
    </button>
    <button class="bibliography-button info-toggle ${state.scrollersOn ? "active" : ""}" data-toggle-scrollers aria-pressed="${
      state.scrollersOn ? "true" : "false"
    }" aria-label="Toggle side scrollers" title="Toggle side scrollers">i</button>
    <button class="bibliography-button" data-open-bibliography aria-label="Open bibliography">[n]</button>
  </section>`;
}

function lineFeature() {
  if (!state.lineFeature) return "";
  return `<div class="line-feature" aria-hidden="true">
    <div class="line-vertical"></div>
    <div class="line-horizontal"></div>
  </div>`;
}

function render() {
  const focus = captureFocus();
  const liveDetailScroll = state.selected ? app.querySelector(".detail")?.scrollTop ?? null : null;
  const categories = ["All", ...new Set(DATA.peptides.map((p) => p.category))];
  const peptides = filteredPeptides();
  refreshCitationRegistry();
  app.innerHTML = `<div class="app-shell">
    ${lineFeature()}${hero()}
    ${atlasFrameOpen()}
    ${toolbar(categories)}
    <section class="tiles">${peptides.map(tile).join("")}</section>
    ${atlasFrameClose()}
    ${detail(state.selected)}
    ${structureModal()}
    ${relatedPanel()}
    ${keyModal()}
    ${bibliographyDrawer()}
    ${noticeToast()}
  </div>`;
  restoreFocus(focus);
  if (state.selected) {
    const detailElement = app.querySelector(".detail");
    const scrollTop = pendingDetailScrollTop ?? liveDetailScroll;
    if (detailElement && typeof scrollTop === "number") detailElement.scrollTop = scrollTop;
  }
  pendingDetailScrollTop = null;
}

function updateLineFeatureDom() {
  const shell = app.querySelector(".app-shell");
  if (!shell) return;
  const existing = app.querySelector(".line-feature");
  if (state.lineFeature && !existing) shell.insertAdjacentHTML("afterbegin", lineFeature());
  if (!state.lineFeature && existing) existing.remove();
  const button = app.querySelector("[data-toggle-line]");
  if (button) {
    button.classList.toggle("active", state.lineFeature);
    button.setAttribute("aria-pressed", state.lineFeature ? "true" : "false");
    button.textContent = state.lineFeature ? "Line On" : "Line Off";
  }
}

app.addEventListener("input", (event) => {
  if (event.target.matches("[data-search]")) {
    state.query = event.target.value;
    gridOnlyRender();
  }
});

app.addEventListener("change", (event) => {
  if (event.target.matches("[data-category]")) state.category = event.target.value;
  if (event.target.matches("[data-sort]")) state.sort = event.target.value;
  if (event.target.matches("[data-study-filter]")) state.studyFilter = event.target.value;
  render();
});

app.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : event.target.parentElement;
  if (!target) return;
  const closeDetail = target.closest("[data-close]");
  const backdrop = target.closest("[data-close-detail]");
  const tagButton = target.closest("[data-tag-type]");
  const clearRelated = target.closest("[data-clear-related]");
  const expandTarget = target.closest("[data-expand]");
  const bibliographyBackdrop = target.closest("[data-close-bibliography]");
  const bibliographyButton = target.closest("[data-open-bibliography]");
  const toggleLine = target.closest("[data-toggle-line]");
  const toggleScrollers = target.closest("[data-toggle-scrollers]");
  const bibliographyClose = target.closest("[data-close-bibliography-button]");
  const openStructure = target.closest("[data-open-structure]");
  const closeStructure = target.closest("[data-close-structure-button]");
  const structureBackdrop = target.closest("[data-close-structure-modal]");
  const keyOpen = target.closest("[data-open-key]");
  const keyBackdrop = target.closest("[data-close-key-modal]");
  const keyClose = target.closest("[data-close-key-button]");
  const relatedBackdrop = target.closest("[data-close-related-modal]");
  const copyLinkButton = target.closest("[data-copy-link]");
  const shareLinkButton = target.closest("[data-share-link]");
  const toggleBrandMode = target.closest("[data-toggle-brand-mode]");
  const interactive = target.closest("button, a, input, select, textarea, .citation");

  if (closeDetail || (backdrop && target === backdrop)) {
    closeToGrid();
    return;
  }

  if (keyOpen) {
    state.keySymbol = keyOpen.dataset.openKey;
    render();
    return;
  }

  if (bibliographyButton) {
    state.bibliographyOpen = true;
    render();
    return;
  }

  if (toggleLine) {
    state.lineFeature = !state.lineFeature;
    updateLineFeatureDom();
    return;
  }

  if (toggleScrollers) {
    state.scrollersOn = !state.scrollersOn;
    render();
    return;
  }

  if (toggleBrandMode) {
    state.brandAlt = !state.brandAlt;
    render();
    return;
  }

  if (bibliographyClose || (bibliographyBackdrop && target === bibliographyBackdrop)) {
    state.bibliographyOpen = false;
    render();
    return;
  }

  if (openStructure) {
    pendingDetailScrollTop = app.querySelector(".detail")?.scrollTop ?? pendingDetailScrollTop ?? 0;
    const peptide = DATA.peptides.find((item) => item.id === openStructure.dataset.openStructure);
    if (peptide) {
      state.structureZoom = { id: peptide.id, name: peptide.names.primary };
      render();
    }
    return;
  }

  if (closeStructure || (structureBackdrop && target === structureBackdrop)) {
    pendingDetailScrollTop = app.querySelector(".detail")?.scrollTop ?? pendingDetailScrollTop ?? 0;
    state.structureZoom = null;
    render();
    return;
  }

  if (keyClose || (keyBackdrop && target === keyBackdrop)) {
    state.keySymbol = null;
    render();
    return;
  }

  if (tagButton) {
    pendingDetailScrollTop = app.querySelector(".detail")?.scrollTop ?? 0;
    state.tag = { type: tagButton.dataset.tagType, value: tagButton.dataset.tagValue, sourcePeptideId: tagButton.dataset.tagSource || null };
    render();
    return;
  }

  if (copyLinkButton) {
    const url = peptideUrl(copyLinkButton.dataset.copyLink);
    const fallbackCopy = () => {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    };
    Promise.resolve()
      .then(() => (navigator.clipboard?.writeText ? navigator.clipboard.writeText(url) : fallbackCopy()))
      .then(() => {
        setNotice("Link copied.");
        render();
      })
      .catch(() => {
        fallbackCopy();
        setNotice("Link copied.");
        render();
      });
    return;
  }

  if (shareLinkButton) {
    const peptideId = shareLinkButton.dataset.shareLink;
    const peptide = DATA.peptides.find((item) => item.id === peptideId);
    const url = peptideUrl(peptideId);
    const payload = {
      title: peptide ? `${peptide.names.primary} | Peptocopeia` : "Peptocopeia",
      text: peptide ? `${peptide.names.primary} on Peptocopeia` : "Peptocopeia",
      url
    };
    Promise.resolve()
      .then(() => {
        if (navigator.share) return navigator.share(payload);
        if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(url);
        return null;
      })
      .then(() => {
        setNotice(navigator.share ? "Share sheet opened." : "Link copied.");
        render();
      })
      .catch(() => {});
    return;
  }

  if (clearRelated || (relatedBackdrop && target === relatedBackdrop)) {
    pendingDetailScrollTop = app.querySelector(".detail")?.scrollTop ?? pendingDetailScrollTop ?? 0;
    state.tag = null;
    render();
    return;
  }

  if (expandTarget && expandTarget.tagName === "BUTTON") {
    openDetail(expandTarget.dataset.expand);
    return;
  }

  if (expandTarget && !interactive) {
    openDetail(expandTarget.dataset.expand);
    return;
  }
});

app.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const expandTarget = event.target.closest("[data-expand]");
    if (expandTarget) {
      openDetail(expandTarget.dataset.expand);
    }
  }
  if (event.key === "Escape") {
    if (state.tag) {
      state.tag = null;
      render();
      return;
    }
    if (state.keySymbol) {
      state.keySymbol = null;
      render();
      return;
    }
    if (state.selected) {
      closeToGrid();
      return;
    }
    if (state.bibliographyOpen) {
      state.bibliographyOpen = false;
      render();
    }
  }
});

window.addEventListener("popstate", () => {
  const peptide = peptideFromLocation();
  if (peptide) {
    state.selected = peptide;
    state.tag = null;
    state.structureZoom = null;
    state.bibliographyOpen = false;
    state.keySymbol = null;
    pendingDetailScrollTop = 0;
  } else {
    resetToGridState();
  }
  render();
});

window.addEventListener("pointermove", (event) => {
  document.documentElement.style.setProperty("--line-x", `${event.clientX}px`);
  document.documentElement.style.setProperty("--line-y", `${event.clientY}px`);
});

const initialPeptide = peptideFromLocation();
if (initialPeptide) {
  state.selected = initialPeptide;
  pendingDetailScrollTop = 0;
  syncHistory("detail", "replace");
} else {
  syncHistory("grid", "replace");
}
render();
