const DATA = window.PEPTIDE_ATLAS_DATA;
const SANDBOX = window.PEPTIDE_SANDBOX_DATA || { generatedAt: null, trackedIds: [], summary: {}, records: {} };
const PEPTIDES = [...DATA.peptides, ...((SANDBOX.candidatePeptides || []).filter((candidate) => !DATA.peptides.some((peptide) => peptide.id === candidate.id)))];
const STRUCTURE_ASSETS = window.PEPTIDE_STRUCTURE_ASSETS || {};
const BRAND = "peptocopeia";
const app = document.getElementById("app");
const STRUCTURE_VIEWER_SCRIPT = "/vendor/3Dmol-min.js";
const STRUCTURE_MODE_ORDER = ["3d", "2d", "none"];
const STRUCTURE_MODE_LABEL = {
  "3d": "3D",
  "2d": "2D",
  none: "Off"
};
const TUTORIAL_EXAMPLE_ID = PEPTIDES.some((peptide) => peptide.id === "bpc-157") ? "bpc-157" : PEPTIDES[0]?.id || null;
const MOBILE_WARNING_SESSION_KEY = "peptocopeia-mobile-warning-seen";
const STACK_STORAGE_KEY = "peptocopeia-review-stack";
const STRUCTURE_ROTATION_SPEED = 0.084;
let structureViewerObserver = null;
let structureViewerLoadPromise = null;
let structureAnimationFrame = null;
const structureModelTextCache = new Map();
const structureViewerControllers = new Set();
let mobileWarningSeenThisPage = false;

function mobileViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches;
}

function hasSeenMobileWarning() {
  if (mobileWarningSeenThisPage) return true;
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(MOBILE_WARNING_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markMobileWarningSeen() {
  mobileWarningSeenThisPage = true;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(MOBILE_WARNING_SESSION_KEY, "1");
  } catch {}
}

function shouldShowMobileWarning() {
  return mobileViewport() && !hasSeenMobileWarning();
}

function loadStackIds() {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(STACK_STORAGE_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((id) => PEPTIDES.some((peptide) => peptide.id === id)) : [];
  } catch {
    return [];
  }
}

function saveStackIds(ids) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STACK_STORAGE_KEY, JSON.stringify(ids));
  } catch {}
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
    infoOpen: false,
    helpOpen: false,
    tutorialOpen: false,
    tutorialStep: 0,
    mobileWarningOpen: shouldShowMobileWarning(),
    structureMode: "3d",
    stackOpen: false,
    stackIds: loadStackIds(),
    stackFocusId: loadStackIds()[0] || null,
    stackSearchOpen: false,
    stackSearchQuery: "",
    priceFilters: {},
    notice: ""
  };
}

function gridOnlyRender() {
  const tiles = app.querySelector(".tiles");
  if (!tiles) {
    render();
    return;
  }
  tiles.innerHTML = tilesMarkup(filteredPeptides());
  initStructureViewers();
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
let state = { ...baseState, ...makeDefaultState() };
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
  [...PEPTIDES]
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
  for (const peptide of PEPTIDES) {
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

function structureAsset(peptideId) {
  return STRUCTURE_ASSETS[peptideId] || SANDBOX.structureAssets?.[peptideId] || null;
}

function structurePoster(peptideId) {
  return structureAsset(peptideId)?.poster || `/structures/${peptideId}.png`;
}

function structureSpin(peptideId) {
  return structureAsset(peptideId)?.spin || "";
}

function structureModel(peptideId) {
  return structureAsset(peptideId)?.model || null;
}

function structureNote(peptideId) {
  return structureAsset(peptideId)?.note || "Illustrative conformer preview; not a definitive solution-state structure.";
}

function structureModeLabel(mode) {
  return STRUCTURE_MODE_LABEL[mode] || "3D";
}

function nextStructureMode(mode) {
  const index = STRUCTURE_MODE_ORDER.indexOf(mode);
  return STRUCTURE_MODE_ORDER[(index + 1) % STRUCTURE_MODE_ORDER.length];
}

function sandboxRecord(peptideId) {
  return SANDBOX.records?.[peptideId] || null;
}

function stackPeptides() {
  return state.stackIds.map((id) => PEPTIDES.find((peptide) => peptide.id === id)).filter(Boolean);
}

function toggleStackPeptide(peptideId) {
  const ids = state.stackIds.includes(peptideId) ? state.stackIds.filter((id) => id !== peptideId) : [...state.stackIds, peptideId];
  state.stackIds = ids;
  if (!ids.length) {
    state.stackFocusId = null;
  } else if (!state.stackFocusId || !ids.includes(state.stackFocusId)) {
    state.stackFocusId = peptideId;
  }
  saveStackIds(ids);
}

function priceFilterState(peptideId) {
  return (
    state.priceFilters[peptideId] || {
      vendor: "all",
      dose: "all",
      window: "3d",
      calcDoseMg: "1",
      calcDosesPerWeek: "1",
      calcPeriodAmount: "1",
      calcPeriodUnit: "months"
    }
  );
}

function setPriceFilter(peptideId, field, value) {
  state.priceFilters = {
    ...state.priceFilters,
    [peptideId]: {
      ...priceFilterState(peptideId),
      [field]: value
    }
  };
}

function underscoreLabel(value) {
  return String(value || "pending")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function reviewValue(value, fallback = "Pending official extraction.") {
  return value ? esc(value) : `<span class="muted">${esc(fallback)}</span>`;
}

function reviewLinks(links) {
  if (!links?.length) return '<span class="muted">No official/regulator citation embedded yet.</span>';
  return `<div class="review-link-list">${links
    .map(
      (link) =>
        `<a class="vendor-link" href="${esc(link.url)}" target="_blank" rel="noreferrer">${esc(link.title)}</a><span class="muted">${esc(
          link.accessedAt || "date pending"
        )}</span>`
    )
    .join("")}</div>`;
}

function citationIdsForLinks(peptide, links = []) {
  if (!peptide?.citations?.length || !links?.length) return [];
  const ids = [];
  for (const link of links) {
    const match = peptide.citations.find(
      (citation) =>
        (citation.url && link.url && citation.url === link.url) ||
        (citation.title && link.title && citation.title === link.title)
    );
    if (match?.id && !ids.includes(match.id)) ids.push(match.id);
  }
  return ids;
}

function reviewLinkInlineList(peptide, links, emptyText = "No direct citation loaded yet.") {
  if (!links?.length) return `<span class="review-inline-copy muted">${esc(emptyText)}</span>`;
  return `<span class="review-inline-copy">${links
    .map((link) => {
      const citationIds = citationIdsForLinks(peptide, [link]);
      return `<span class="review-inline-item">${esc(link.title)} ${
        citationIds.length
          ? citationRefsByIds(peptide, citationIds)
          : '<span class="muted review-inline-missing">support citation not embedded yet.</span>'
      }</span>`;
    })
    .join("")}</span>`;
}

function panelKey(value) {
  return String(value || "panel")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function peptideRegulatoryLinks(peptide) {
  const review = sandboxRecord(peptide.id);
  const official = review?.regulatory?.officialSources || [];
  if (official.length) return official;
  return (peptide.citations || [])
    .filter((citation) =>
      ["fda_label", "regulator_news", "official_regulator", "clinicaltrials", "drug_label"].includes(citation.sourceType)
    )
    .slice(0, 3)
    .map((citation) => ({
      title: citation.title,
      url: citation.url,
      accessedAt: citation.accessedAt || null
    }));
}

function peptideEvidenceCitationIds(peptide) {
  return [
    ...new Set(
      (peptide.claims || [])
        .filter((claim) => Array.isArray(claim.citationIds) && claim.citationIds.length)
        .flatMap((claim) => claim.citationIds)
    )
  ].slice(0, 4);
}

function vendorScoreBar(score) {
  const numeric = typeof score === "number" ? Math.max(0, Math.min(score, 10)) : null;
  return `<div class="vendor-score-bar" aria-hidden="true"><span style="width:${numeric === null ? 0 : numeric * 10}%"></span></div>`;
}

function sectionFrame({ title, body, eyebrow = "", badge = "", className = "", open = false, key = "" }) {
  return `<details class="article-section collapsible-section ${className}" data-panel-key="${esc(key || panelKey(title))}" ${open ? "open" : ""}>
    <summary class="section-toggle">
      <div>
        ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ""}
        <h3>${esc(title)}</h3>
      </div>
      <span class="section-toggle-meta" aria-hidden="true"></span>
    </summary>
    <div class="section-body">
      ${body}
    </div>
  </details>`;
}

function peptidePriceObservations(peptideId) {
  const review = sandboxRecord(peptideId);
  return Array.isArray(review?.priceReview?.observations) ? review.priceReview.observations : [];
}

function packageAmount(row) {
  return row.package_mg ?? row.package_amount ?? null;
}

function packageUnit(row) {
  return row.package_unit || (row.package_mg != null ? "mg" : null);
}

function packageLabel(row) {
  if (row.package_label) return row.package_label;
  const amount = packageAmount(row);
  const unit = packageUnit(row);
  if (amount != null && unit) return `${amount} ${unit}`;
  return "unlabeled package";
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => {
    const aNum = Number(a);
    const bNum = Number(b);
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
    return String(a).localeCompare(String(b));
  });
}

function filteredPriceObservations(peptideId) {
  const filter = priceFilterState(peptideId);
  const rows = peptidePriceObservations(peptideId).filter((row) => {
    if (filter.vendor !== "all" && row.vendor !== filter.vendor) return false;
    if (filter.dose !== "all" && packageLabel(row) !== filter.dose) return false;
    return true;
  });
  if (!rows.length) return [];
  const sorted = [...rows].sort((a, b) => String(a.observed_at || "").localeCompare(String(b.observed_at || "")));
  if (filter.window === "all") return sorted;
  const days = filter.window === "30d" ? 30 : filter.window === "7d" ? 7 : 3;
  const last = sorted[sorted.length - 1]?.observed_at;
  if (!last) return sorted;
  const lastDate = new Date(`${last}T00:00:00Z`);
  return sorted.filter((row) => {
    const rowDate = new Date(`${row.observed_at}T00:00:00Z`);
    return (lastDate - rowDate) / 86400000 <= days - 1;
  });
}

function vendorColor(index) {
  return ["#87e8ff", "#4ade80", "#fbbf24", "#f87171", "#c8b7ff", "#fdba74", "#9fb0c4"][index % 7];
}

function itemSafeColor(value) {
  return typeof value === "string" && value ? value : "#87e8ff";
}

function priceSeries(peptideId) {
  const rows = filteredPriceObservations(peptideId);
  const byKey = new Map();
  for (const row of rows) {
    const key = `${row.vendor}::${packageLabel(row)}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  }
  const vendorOrder = uniqueSorted(rows.map((row) => row.vendor));
  const vendorPackageMap = new Map();
  for (const vendor of vendorOrder) {
    vendorPackageMap.set(vendor, uniqueSorted(rows.filter((row) => row.vendor === vendor).map((row) => packageLabel(row))));
  }
  return [...byKey.entries()].map(([key, series]) => {
    const [vendor, packageDisplay] = key.split("::");
    const vendorIndex = vendorOrder.indexOf(vendor);
    const packageRank = vendorPackageMap.get(vendor)?.indexOf(packageDisplay) ?? 0;
    const dash = packageRank <= 0 ? "" : packageRank === 1 ? "10 8" : packageRank === 2 ? "8 6" : packageRank === 3 ? "6 4" : "4 3";
    return {
      key,
      vendor,
      packageLabel: packageDisplay,
      color: vendorColor(vendorIndex),
      dash,
      rows: series.sort((a, b) => String(a.observed_at).localeCompare(String(b.observed_at)))
    };
  });
}

function bestPriceSummary(peptideId) {
  const rows = peptidePriceObservations(peptideId).filter((row) => typeof row.price_usd === "number" && typeof packageAmount(row) === "number");
  if (!rows.length) return null;
  const best = [...rows].sort(
    (a, b) =>
      (a.price_per_mg ?? a.price_per_unit ?? a.price_usd / packageAmount(a)) -
      (b.price_per_mg ?? b.price_per_unit ?? b.price_usd / packageAmount(b))
  )[0];
  const amount = packageAmount(best);
  const perUnit = best.price_per_mg ?? best.price_per_unit ?? Number((best.price_usd / amount).toFixed(4));
  return {
    vendor: best.vendor,
    packageAmount: amount,
    packageUnit: packageUnit(best) || "units",
    packageLabel: packageLabel(best),
    priceUsd: best.price_usd,
    pricePerUnit: perUnit
  };
}

function selectedCalculatorObservation(peptideId) {
  const rows = filteredPriceObservations(peptideId)
    .filter((row) => typeof row.price_usd === "number" && typeof packageAmount(row) === "number")
    .sort((a, b) => {
      const perUnitA = a.price_per_mg ?? a.price_per_unit ?? a.price_usd / packageAmount(a);
      const perUnitB = b.price_per_mg ?? b.price_per_unit ?? b.price_usd / packageAmount(b);
      return perUnitA - perUnitB || String(b.observed_at || "").localeCompare(String(a.observed_at || ""));
    });
  return rows[0] || null;
}

function periodDays(unit, amount) {
  const numeric = Math.max(0, Number(amount) || 0);
  if (unit === "days") return numeric;
  if (unit === "weeks") return numeric * 7;
  if (unit === "years") return numeric * 365;
  return numeric * 30;
}

function calculatorMetrics(peptideId) {
  const filter = priceFilterState(peptideId);
  const row = selectedCalculatorObservation(peptideId);
  if (!row) return null;
  const doseAmount = Math.max(0, Number(filter.calcDoseMg) || 0);
  const dosesPerWeek = Math.max(0, Number(filter.calcDosesPerWeek) || 0);
  const periodAmount = Math.max(0, Number(filter.calcPeriodAmount) || 0);
  const periodUnit = filter.calcPeriodUnit || "months";
  const totalDays = periodDays(periodUnit, periodAmount);
  const totalDoses = dosesPerWeek * (totalDays / 7);
  const amount = packageAmount(row);
  const unit = packageUnit(row) || "mg";
  if (amount == null) return null;
  const perUnit = row.price_per_mg ?? row.price_per_unit ?? row.price_usd / amount;
  const costPerDose = doseAmount * perUnit;
  const periodCost = totalDoses * costPerDose;
  return {
    row,
    doseAmount,
    doseUnit: unit,
    dosesPerWeek,
    periodAmount,
    periodUnit,
    totalDays,
    totalDoses,
    costPerDose,
    periodCost,
    monthlyCost: totalDays ? (periodCost / totalDays) * 30 : 0,
    dailyCost: totalDays ? periodCost / totalDays : 0,
    yearlyCost: totalDays ? (periodCost / totalDays) * 365 : 0
  };
}

function severityRank(color) {
  if (color === "red") return 3;
  if (color === "amber") return 2;
  if (color === "yellow") return 1;
  return 0;
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
  if (name === "5-Amino-1-methylquinolinium") return esc(name);
  return esc(name).replace(/-([a-z]+)$/g, '-<span class="name-lower">$1</span>');
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
  return PEPTIDES.find((peptide) => peptide.id === id) || null;
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

function riskPill(label, color) {
  return `<button class="organ-pill organ-pill-button" type="button" style="--organ-color:${esc(color || "yellow")}" data-open-key="risk:${esc(
    color || "yellow"
  )}">
    <span class="organ-dot"></span>${esc(label)}
  </button>`;
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

function structureViewerMarkup(id, name, action, className = "") {
  const model = structureModel(id);
  const poster = structurePoster(id);
  if (!model) {
    return `<img class="structure-media ${esc(className)}" src="${esc(poster)}" alt="${esc(name)} structure" loading="lazy">`;
  }
  return `<div class="structure-surface ${esc(className)}" data-structure-action="${esc(action)}" data-structure-id="${esc(id)}" data-structure-name="${esc(name)}">
    <div class="structure-viewer-shell" data-structure-viewer data-model-src="${esc(model.src)}" data-model-format="${esc(
      model.format || "sdf"
    )}" data-model-name="${esc(name)}"></div>
    <img class="structure-viewer-fallback" src="${esc(poster)}" alt="${esc(name)} structure fallback" hidden>
  </div>`;
}

function structureImageMarkup(id, name, action, className = "") {
  const poster = structurePoster(id);
  return `<button class="structure-image-button ${esc(className)}" type="button" data-structure-action="${esc(action)}" data-structure-id="${esc(
    id
  )}" data-structure-name="${esc(name)}">
    <img class="structure-media" src="${esc(poster)}" alt="${esc(name)} structure" loading="lazy">
  </button>`;
}

function tileStructurePreview(p) {
  if (state.structureMode === "none") return "";
  if (state.structureMode === "2d") {
    return `<div class="tile-structure tile-structure-2d">
      ${structureImageMarkup(p.id, p.names.primary, "expand", "tile-structure-surface")}
    </div>`;
  }
  return `<div class="tile-structure tile-structure-3d">
    ${structureViewerMarkup(p.id, p.names.primary, "expand", "tile-structure-surface")}
  </div>`;
}

function searchable(p) {
  return norm([
    p.id,
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
  ].join(" "));
}

function filteredPeptides() {
  return PEPTIDES
    .filter((p) => {
      const matchesQuery = !state.query || searchable(p).includes(norm(state.query));
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
    ...makeDefaultState(),
    lineFeature: state.lineFeature,
    structureMode: state.structureMode,
    notice: state.notice,
    infoOpen: state.infoOpen,
    helpOpen: state.helpOpen,
    tutorialOpen: state.tutorialOpen,
    tutorialStep: state.tutorialStep
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
  state.selected = PEPTIDES.find((p) => p.id === peptideId) || null;
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
  const rows = PEPTIDES
    .map((p) => {
      const matches = [];
      const blob = peptideTextBlob(p);
      if (state.tag.type === "effect") {
        p.tile.enhancingEffects.forEach((effect) => {
          const item = norm(effect.label);
          if (targets.some((value) => item.includes(value) || value.includes(item))) addMatch(matches, effect.label);
        });
        if (targets.some((value) => blob.includes(value))) addMatch(matches, "shared mechanism");
        if (p.biology.cascades.some((chain) => targets.some((value) => norm(chain.category).includes(value)))) addMatch(matches, "related pathway");
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
      if (!matches.length && tokens.some((token) => token.length > 3 && blob.includes(token))) addMatch(matches, "shared mention");
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
  return state.tag?.sourcePeptideId ? PEPTIDES.find((p) => p.id === state.tag.sourcePeptideId) || null : null;
}

function addMatch(matches, label) {
  if (label && !matches.includes(label)) matches.push(label);
}

function cachedTagSummary(tagState, rows) {
  const cacheKey = `${tagState.type}:${tagState.value}`;
  if (tagSummaryCache.has(cacheKey)) return tagSummaryCache.get(cacheKey);
  const canonical = infoQueryForTag(tagState);
  const peptides = rows.slice(0, 4).map((row) => row.p.names.primary);
  const formatList = (items) => {
    if (items.length <= 1) return items.join("");
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
  };
  const extract = peptides.length
    ? `${canonical} appears in the atlas alongside ${formatList(peptides)}.`
    : `${canonical} does not yet have linked peptides catalogued in the atlas.`;
  const summary = { title: canonical, extract };
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

function mobileTileScroller(index) {
  const direction = index % 2 === 0 ? "left" : "right";
  const glyphs = "PEPTIDE  SIGNALING  ATLAS  ".split("");
  const repeated = Array.from({ length: 10 }, () => glyphs)
    .flat()
    .map((char) => `<span>${esc(char === " " ? " " : char)}</span>`)
    .join("");
  return `<div class="mobile-tile-scroller mobile-tile-scroller-${esc(direction)}" aria-hidden="true">
    <div class="mobile-tile-scroller-track">${repeated}</div>
  </div>`;
}

function tilesMarkup(peptides) {
  if (!peptides.length) return "";
  return peptides.map((peptide, index) => `${index > 0 ? mobileTileScroller(index) : ""}${tile(peptide)}`).join("");
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
  return sectionFrame({
    title: "Physiological Pathways",
    body: `
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
          (chain, chainIndex) => {
            const claim = p.claims.find((item) => item.id === chain.claimRef);
            const description = pathwayNarrative(chain);
            return `<details class="pathway-card" data-panel-key="${esc(panelKey(`pathway-${p.id}-${chain.category}-${chainIndex}`))}" ${chainIndex === 0 ? "" : ""}>
            <summary class="pathway-card-head">
              <div class="pathway-card-title">
                <p class="eyebrow">${esc(chain.category)} ${symbols(chain.symbols)}</p>
                <h4>${esc(chain.category)}</h4>
              </div>
              <div class="pathway-cites">${claim ? citationRefsByIds(p, claim.citationIds) : ""}</div>
            </summary>
            <div class="pathway-card-body">
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
            </div>
          </details>`;
          }
        )
        .join("")}
    </div>
  `
  });
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
  return sectionFrame({
    title: "Supporting Studies",
    body: `
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
  `
  });
}

function safetyPanel(p, define = (text) => String(text || "")) {
  const rows = p.expanded.safetyRisks || [];
  return sectionFrame({
    title: "Safety Risks",
    body: `
    <p class="section-note">${esc(define(p.expanded.safetyDetail))}</p>
    <table>
      <thead><tr><th>Organ system</th><th>Potential help</th><th>Potential harm</th></tr></thead>
      <tbody>${
        rows.length
          ? rows
              .map(
                (row) => `<tr>
                  <td>${riskPill(row.label, row.color)}</td>
                  <td>${esc(define(row.helpSummary || "No organ-specific benefit extracted."))} ${citationRefsByIds(p, row.citationIds)}</td>
                  <td>${esc(define(row.harmSummary || "No organ-specific harm extracted."))} ${citationRefsByIds(p, row.citationIds)}</td>
                </tr>`
              )
              .join("")
          : '<tr><td colspan="3">Organ-specific safety curation is still pending for this peptide.</td></tr>'
      }</tbody>
    </table>
  `
  });
}

function enhancementPanel(p, define = (text) => String(text || "")) {
  const item = p.expanded.enhancementPotential;
  return sectionFrame({
    title: "Enhancement Potential",
    body: `
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
  `
  });
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

function mobileWarningModal() {
  if (!state.mobileWarningOpen) return "";
  return `<section class="mobile-warning-backdrop" data-close-mobile-warning>
    <aside class="mobile-warning-modal" role="dialog" aria-modal="true" aria-label="Mobile warning">
      <p class="eyebrow">Notice</p>
      <h3>NOT OPTIMIZED FOR MOBILE</h3>
      <button class="bibliography-button" data-dismiss-mobile-warning aria-label="Dismiss mobile warning">Continue</button>
    </aside>
  </section>`;
}

function infoModal() {
  if (!state.infoOpen) return "";
  return `<section class="info-backdrop" data-close-info>
    <aside class="info-modal" role="dialog" aria-modal="true" aria-label="About this site">
      <p class="eyebrow">Information</p>
      <p>Built to accelerate education. More projects at <a href="https://jacobbudnitz.com" target="_blank" rel="noreferrer">jacobbudnitz.com</a>.</p>
      <button class="bibliography-button" data-close-info-button aria-label="Close information">Close</button>
    </aside>
  </section>`;
}

function helpModal() {
  return "";
}

function tutorialSteps() {
  return [
    {
      key: "hero",
      title: "Structure Mode",
      body: "Click the site title to cycle tile media between spinning 3D previews, the legacy 2D images, and an image-free grid.",
      target: ".brand-title-button",
      placement: "bottom"
    },
    {
      key: "toolbar",
      title: "Search And Filters",
      body: "Use search, category, evidence, and sort controls to change the atlas view without leaving the landing grid.",
      target: ".toolbar",
      placement: "bottom"
    },
    {
      key: "tile",
      title: "Tile Entry",
      body: "Each tile can be opened directly. In 3D mode, the tile surface previews the structure; clicking the tile opens the expanded record.",
      target: TUTORIAL_EXAMPLE_ID ? `[data-expand=\"${TUTORIAL_EXAMPLE_ID}\"]` : ".tile",
      placement: "top"
    },
    {
      key: "detail",
      title: "Expanded Record",
      body: "The expanded view contains collapsible sections, 3D and 2D structure cards, regulatory and vendor review panels, and linked evidence chips.",
      target: ".detail",
      placement: "top"
    },
    {
      key: "stack",
      title: "Build Stack",
      body: "The stack builder lets you add peptides, compare them side by side, inspect aggregated safety overlap, and review package pricing.",
      target: ".stack-drawer",
      placement: "top"
    }
  ];
}

function activeTutorialStep() {
  const steps = tutorialSteps();
  return steps[state.tutorialStep] || steps[0];
}

function syncTutorialState() {
  if (!state.tutorialOpen) return;
  const step = activeTutorialStep();
  if (!step) return;
  if (step.key === "hero" || step.key === "toolbar" || step.key === "tile") {
    state.selected = null;
    state.stackOpen = false;
  }
  if (step.key === "detail" && TUTORIAL_EXAMPLE_ID) {
    state.selected = PEPTIDES.find((peptide) => peptide.id === TUTORIAL_EXAMPLE_ID) || null;
    state.stackOpen = false;
  }
  if (step.key === "stack") {
    state.selected = null;
    state.stackOpen = true;
  }
}

function tutorialOverlay() {
  if (!state.tutorialOpen) return "";
  const step = activeTutorialStep();
  if (!step) return "";
  const steps = tutorialSteps();
  return `<section class="info-backdrop tutorial-backdrop" data-close-tutorial>
    <aside class="info-modal tutorial-modal tutorial-modal-${esc(step.placement || "bottom")}" role="dialog" aria-modal="true" aria-label="Site tutorial">
      <p class="eyebrow">Tutorial ${esc(String(state.tutorialStep + 1))} / ${esc(String(steps.length))}</p>
      <h3>${esc(step.title)}</h3>
      <p>${esc(step.body)}</p>
      <div class="tutorial-actions">
        <button class="bibliography-button" ${state.tutorialStep === 0 ? "disabled" : ""} data-tutorial-nav="prev">Back</button>
        <button class="bibliography-button" data-tutorial-nav="${state.tutorialStep >= steps.length - 1 ? "finish" : "next"}">${
          state.tutorialStep >= steps.length - 1 ? "Finish" : "Next"
        }</button>
      </div>
    </aside>
  </section>`;
}

function updateTutorialHighlight() {
  document.querySelectorAll(".tutorial-focus").forEach((node) => node.classList.remove("tutorial-focus"));
  if (!state.tutorialOpen) return;
  const step = activeTutorialStep();
  const target = step?.target ? document.querySelector(step.target) : null;
  if (!target) return;
  target.classList.add("tutorial-focus");
  if (typeof target.scrollIntoView === "function") {
    target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  }
}

function structureModal() {
  if (!state.structureZoom) return "";
  const poster = structurePoster(state.structureZoom.id);
  const model = structureModel(state.structureZoom.id);
  const note = structureNote(state.structureZoom.id);
  const show3d = state.structureZoom.kind !== "2d" && model;
  return `<section class="image-backdrop" data-close-structure-modal>
    <aside class="image-modal" aria-label="${esc(state.structureZoom.name)} structure image">
      <header class="modal-head">
        <div>
          <p class="eyebrow">structure</p>
          <h3>${esc(state.structureZoom.name)}</h3>
        </div>
        <button class="icon modal-close" data-close-structure-button aria-label="Close structure image">x</button>
      </header>
      ${
        show3d
          ? `<div class="image-modal-frame structure-viewer-frame">
        ${structureViewerMarkup(state.structureZoom.id, state.structureZoom.name, "noop", "structure-modal-surface")}
      </div>`
          : `<div class="image-modal-frame">
        <img src="${esc(poster)}" alt="${esc(state.structureZoom.name)} enlarged structure">
      </div>`
      }
      <p class="structure-note">${esc(note)}</p>
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
    const [tier, peptideId] = token.slice(5).split("|");
    const peptide = peptideId ? PEPTIDES.find((item) => item.id === peptideId) : null;
    const peptideSpecific =
      tier === "secondary_only" && peptide
        ? `For ${peptide.names.primary}, the imported record is still driven mainly by review-level or secondary synthesis. Primary verification is still missing or incomplete for: ${
            peptide.expanded.missingEvidence?.slice(0, 4).join("; ") || "the key record fields"
          }.`
        : evidenceTierExplanation(tier);
    return {
      title: DATA.evidenceTierLabel[tier] || "Evidence tier",
      body: `<div class="key-grid"><div class="key-row active"><span class="key-icon"></span><div><strong>${esc(
        DATA.evidenceTierLabel[tier] || tier
      )}</strong><p>${esc(peptideSpecific)}</p>${
        peptide ? `<p>${reviewLinkInlineList(peptide, peptideRegulatoryLinks(peptide), "No primary approval or trial citation is attached to this tag yet.")}</p>` : ""
      }</div></div></div>`
    };
  }

  if (token.startsWith("regulatory:")) {
    const [status, peptideId] = token.slice(11).split("|");
    const peptide = peptideId ? PEPTIDES.find((item) => item.id === peptideId) : null;
    const links = peptide ? peptideRegulatoryLinks(peptide) : [];
    return {
      title: "Regulatory status",
      body: `<div class="key-grid"><div class="key-row active"><span class="key-icon"></span><div><strong>${esc(
        status.replaceAll("_", " ")
      )}</strong><p>${esc(regulatoryLabel(status))}</p><p>${
        peptide
          ? reviewLinkInlineList(peptide, links, "This peptide does not currently have a linked approval page or trial page in the embedded record.")
          : ""
      }</p></div></div></div>`
    };
  }

  if (token.startsWith("risk:")) {
    const severity = token.slice(5);
    const labels = {
      red: {
        title: "Higher-concern signal",
        text: "Red marks the stronger caution rows in the current record: concrete safety concern, hard regulatory limitation, or a major evidence failure."
      },
      yellow: {
        title: "Caution / monitor signal",
        text: "Yellow marks caution-level rows: monitorable risk, uncertainty, vendor-quality concern, or a context-dependent downside that should still be surfaced."
      },
      amber: {
        title: "Intermediate concern signal",
        text: "Amber marks a middle severity band when a risk is more serious than a simple caution but less definitive than the strongest red flags."
      }
    };
    const item = labels[severity] || labels.yellow;
    return {
      title: item.title,
      body: `<div class="key-grid"><div class="key-row active"><span class="key-icon"><span class="organ-dot" style="--organ-color:${esc(
        severity
      )}"></span></span><div><p>${esc(item.text)}</p></div></div></div>`
    };
  }

  if (token.startsWith("dosing:")) {
    const context = token.slice(7);
    return {
      title: "Dosing context",
      body: `<div class="key-grid"><div class="key-row active"><span class="key-icon"></span><div><strong>${esc(context.replaceAll("_", " "))}</strong><p>${esc(
        dosingContextLabel(context)
      )}</p></div></div></div>`
    };
  }

  if (token.startsWith("moderation:")) {
    const status = token.slice(11);
    return {
      title: "Moderator status",
      body: `<div class="key-grid"><div class="key-row active"><span class="key-icon"></span><div><strong>${esc(moderationLabel(status))}</strong><p>${esc(
        moderationExplanation(status)
      )}</p></div></div></div>`
    };
  }

  return {
    title: "Key",
    body: `<div class="key-grid"><div class="key-row active"><span class="key-icon"></span><div><p>No additional key text is available for this item yet.</p></div></div></div>`
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
    <div class="structure-card">
      <div class="structure-card-head">
        <p class="eyebrow">3D preview</p>
      </div>
      ${structureViewerMarkup(p.id, p.names.primary, "modal-3d", "structure-panel-surface")}
    </div>
    <div class="structure-card">
      <div class="structure-card-head">
        <p class="eyebrow">2D structure</p>
      </div>
      ${structureImageMarkup(p.id, p.names.primary, "modal-2d", "structure-panel-surface")}
    </div>
    ${structureSummaryPanel(p)}
  </div>`;
}

function interactableBiologyGrid(p, define = (value) => String(value || "")) {
  return `<div class="tag-groups intro-tag-groups">
    <div class="tag-block"><h4>Effects</h4><div class="tag-flow">${p.tile.enhancingEffects.map((effect) => tag("effect", effect.label, effect.symbols, p.id, define(effect.label))).join("") || '<span class="muted">Pending extraction</span>'}</div></div>
    <div class="tag-block"><h4>Genes</h4><div class="tag-flow">${p.biology.genes.map((gene) => tag("gene", gene, [], p.id, define(gene))).join("") || '<span class="muted">Pending extraction</span>'}</div></div>
    <div class="tag-block"><h4>Proteins</h4><div class="tag-flow">${p.biology.proteins.map((protein) => tag("protein", protein, [], p.id, define(protein))).join("") || '<span class="muted">Pending extraction</span>'}</div></div>
    <div class="tag-block"><h4>Channels</h4><div class="tag-flow">${p.biology.channelsTransporters.map((channel) => tag("channel", channel, [], p.id, define(channel))).join("") || '<span class="muted">Pending extraction</span>'}</div></div>
  </div>`;
}

function interactableBiologySection(p, define = (value) => String(value || "")) {
  return sectionFrame({
    title: "Interactable Biology",
    body: interactableBiologyGrid(p, define)
  });
}

function structureSupportPanel(p) {
  return `<div class="structure-support-box">
    <div class="status-pill-row">
      <button class="evidence-badge ${evidenceClass(p.classification.evidenceTier)} key-chip" type="button" data-open-key="tier:${esc(
        `${p.classification.evidenceTier}|${p.id}`
      )}">${esc(DATA.evidenceTierLabel[p.classification.evidenceTier])}</button>
      <button class="status-pill key-chip" type="button" data-open-key="regulatory:${esc(
        `${p.classification.regulatoryStatus}|${p.id}`
      )}">${esc(
        p.classification.regulatoryStatus.replaceAll("_", " ")
      )}</button>
      <button class="status-pill key-chip" type="button" data-open-key="dosing:${esc(p.tile.dosing.context)}">dosing: ${esc(
        p.tile.dosing.context.replaceAll("_", " ")
      )}</button>
      <button class="status-pill key-chip" type="button" data-open-key="moderation:${esc(p.moderation.status)}">${esc(
        moderationLabel(p.moderation.status)
      )}</button>
    </div>
    <div class="review-status-links">${reviewLinkInlineList(
      p,
      peptideRegulatoryLinks(p),
      "No approval page or trial page is attached to this peptide's regulatory tag yet."
    )}</div>
  </div>`;
}

function chemicalIdentityPanel(p) {
  const properties = p.identity?.properties || {};
  const review = sandboxRecord(p.id);
  const pk = review?.pk || null;
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
      <dt>Volume of distribution</dt><dd>${reviewValue(
        pk?.volumeOfDistribution ? `${pk.volumeOfDistribution} ${pk.vdUnits || ""}`.trim() : null,
        "Vd extraction not loaded yet."
      )}</dd>
      <dt>First-pass metabolism</dt><dd>${reviewValue(pk?.firstPass, "No normalized first-pass field yet.")}</dd>
      <dt>Phase I metabolism</dt><dd>${reviewValue(pk?.phase1Metabolism, "No normalized phase I metabolism field yet.")}</dd>
      <dt>Phase II metabolism</dt><dd>${reviewValue(pk?.phase2Metabolism, "No normalized phase II metabolism field yet.")}</dd>
    </dl>
  </section>`;
}

function regulatoryPkPanel(p) {
  const review = sandboxRecord(p.id);
  if (!review) return "";
  const reg = review.regulatory || {};
  const pk = review.pk || {};
  const officialLinks = peptideRegulatoryLinks(p);
  const properties = p.identity?.properties || {};
  const halfLifeRefs = properties.halfLife?.citationIds?.length ? citationRefsByIds(p, properties.halfLife.citationIds) : "";
  const adminRefs = properties.administration?.citationIds?.length ? citationRefsByIds(p, properties.administration.citationIds) : "";
  const evidenceRefs = citationRefsByIds(p, peptideEvidenceCitationIds(p));
  return sectionFrame({
    title: "Regulatory Status And PK Audit",
    eyebrow: "",
    badge: review.reviewState.replaceAll("_", " "),
    className: "review-section",
    body: `
    <table>
      <tbody>
        <tr><th>Atlas regulatory status</th><td>${esc(underscoreLabel(reg.atlasStatus))} ${reviewLinkInlineList(
          p,
          officialLinks,
          "This status tag is not yet supported by an embedded approval or trial page."
        )}</td></tr>
        <tr><th>Evidence tier</th><td>${esc(underscoreLabel(reg.evidenceTier))} ${
          evidenceRefs || '<span class="muted">No direct evidence-tier citation bundle loaded yet.</span>'
        }</td></tr>
        <tr><th>Embedded official sources</th><td>${reviewLinks(reg.officialSources)}</td></tr>
        <tr><th>Regulatory audit note</th><td>${reviewValue(reg.note, "No audit note attached.")} ${reviewLinkInlineList(
          p,
          officialLinks,
          "No approval or trial source has been attached yet."
        )}</td></tr>
        <tr><th>Imported half-life</th><td>${reviewValue(pk.halfLife, "No normalized half-life value imported.")} ${
          halfLifeRefs || '<span class="muted">No half-life citation embedded yet.</span>'
        }</td></tr>
        <tr><th>Imported route context</th><td>${reviewValue(pk.administration, "No route context imported.")} ${
          adminRefs || '<span class="muted">No route-context citation embedded yet.</span>'
        }</td></tr>
        <tr><th>Volume of distribution</th><td>${reviewValue(
          pk.volumeOfDistribution ? `${pk.volumeOfDistribution} ${pk.vdUnits || ""}`.trim() : null,
          "Pending label extraction."
        )} <span class="muted">No source-locked Vd citation loaded yet.</span></td></tr>
        <tr><th>Vd population</th><td>${reviewValue(pk.vdPopulation, "Pending label extraction.")}</td></tr>
        <tr><th>First-pass metabolism</th><td>${reviewValue(
          pk.firstPass,
          "Pending normalization or not yet applicable."
        )} <span class="muted">No source-locked citation loaded yet.</span></td></tr>
        <tr><th>Phase I metabolism</th><td>${reviewValue(
          pk.phase1Metabolism,
          "Pending normalization."
        )} <span class="muted">No source-locked citation loaded yet.</span></td></tr>
        <tr><th>Phase II metabolism</th><td>${reviewValue(
          pk.phase2Metabolism,
          "Pending normalization."
        )} <span class="muted">No source-locked citation loaded yet.</span></td></tr>
        <tr><th>PK audit note</th><td>${reviewValue(pk.metabolismNote, "No PK audit note attached.")} ${reviewLinkInlineList(
          p,
          officialLinks,
          "No linked label or trial source is attached to this PK note yet."
        )}</td></tr>
      </tbody>
    </table>
  `
  });
}

function qualityReviewPanel(p) {
  const review = sandboxRecord(p.id);
  if (!review) return "";
  const quality = review.qualitySummary || {};
  const priceReview = review.priceReview || {};
  return sectionFrame({
    title: "Vendor Quality And Price Capture",
    eyebrow: "",
    badge: priceReview.status?.replaceAll("_", " ") || "review only",
    className: "review-section",
    body: `
    <div class="review-section-head">
      <div></div>
      <span class="review-state-pill">${esc(priceReview.status?.replaceAll("_", " ") || "review only")}</span>
    </div>
    <div class="review-stats">
      <article><span class="review-stat-label">quality vendors</span><strong>${esc(String(quality.vendorCount ?? 0))}</strong></article>
      <article><span class="review-stat-label">mean score</span><strong>${esc(quality.meanScore != null ? `${quality.meanScore}/10` : "n/a")}</strong></article>
      <article><span class="review-stat-label">quality date span</span><strong>${esc(
        quality.dateSpan ? `${quality.dateSpan.first} -> ${quality.dateSpan.last}` : "n/a"
      )}</strong></article>
      <article><span class="review-stat-label">price points</span><strong>${esc(String(priceReview.observations?.length || 0))}</strong></article>
    </div>
    <p class="section-note">${esc(priceReview.note || "No vendor review note attached.")}</p>
    <table>
      <thead><tr><th>Vendor</th><th>Score</th><th>Tests</th><th>Date range</th><th>Source</th></tr></thead>
      <tbody>${
        review.qualityObservations?.length
          ? review.qualityObservations
              .map(
                (row) => `<tr>
                  <td>${esc(row.vendor)}</td>
                  <td><div class="vendor-score-cell"><span>${esc(
                    row.score != null ? `${row.score}/10 (${row.grade || "?"})` : "n/a"
                  )}</span>${vendorScoreBar(row.score)}</div></td>
                  <td>${esc(row.testCount != null ? String(row.testCount) : "n/a")}</td>
                  <td>${esc([row.oldestTest, row.latestTest].filter(Boolean).join(" -> ") || "n/a")}</td>
                  <td>${row.vendorUrl ? `<a class="vendor-link" href="${esc(row.vendorUrl)}" target="_blank" rel="noreferrer">Finnrick vendor page</a>` : "n/a"}</td>
                </tr>`
              )
              .join("")
          : '<tr><td colspan="5">No vendor-quality rows are embedded for this peptide yet.</td></tr>'
      }</tbody>
    </table>
    ${priceGraphPanel(p)}
  `
  });
}

function priceGraphPanel(p) {
  const observations = peptidePriceObservations(p.id);
  if (!observations.length) {
    return `<div class="price-graph-shell"><p class="section-note">No normalized price observations are loaded for this peptide yet.</p></div>`;
  }
  const filter = priceFilterState(p.id);
  const vendors = uniqueSorted(observations.map((row) => row.vendor));
  const doses = uniqueSorted(observations.map((row) => packageLabel(row)).filter(Boolean));
  const series = priceSeries(p.id);
  const dates = uniqueSorted(filteredPriceObservations(p.id).map((row) => row.observed_at));
  const maxPrice = Math.max(...filteredPriceObservations(p.id).map((row) => Number(row.price_usd || 0)), 1);
  const minPrice = Math.min(...filteredPriceObservations(p.id).map((row) => Number(row.price_usd || 0)), maxPrice);
  const calculator = calculatorMetrics(p.id);
  const calculatorUnit = calculator?.doseUnit || (series[0]?.rows?.[0] ? packageUnit(series[0].rows[0]) || "mg" : "mg");
  const legendGroups = vendors.map((vendor) => ({
    vendor,
    color: series.find((item) => item.vendor === vendor)?.color || vendorColor(vendors.indexOf(vendor)),
    items: series.filter((item) => item.vendor === vendor)
  }));
  const width = 580;
  const height = 230;
  const padX = 60;
  const padY = 18;
  const graphW = width - padX * 2;
  const graphH = height - padY * 2 - 18;
  const xAt = (index) => (dates.length <= 1 ? padX + graphW / 2 : padX + (graphW * index) / (dates.length - 1));
  const yAt = (price) => {
    const span = maxPrice - minPrice || 1;
    return padY + graphH - ((price - minPrice) / span) * graphH;
  };
  return `<div class="price-graph-shell">
    <div class="price-graph-controls">
      <label>manufacturer
        <select data-price-vendor="${esc(p.id)}">
          <option value="all"${filter.vendor === "all" ? " selected" : ""}>all</option>
          ${vendors.map((vendor) => `<option value="${esc(vendor)}"${filter.vendor === vendor ? " selected" : ""}>${esc(vendor)}</option>`).join("")}
        </select>
      </label>
      <label>dose
        <select data-price-dose="${esc(p.id)}">
          <option value="all"${filter.dose === "all" ? " selected" : ""}>all</option>
          ${doses.map((dose) => `<option value="${esc(String(dose))}"${String(filter.dose) === String(dose) ? " selected" : ""}>${esc(String(dose))}</option>`).join("")}
        </select>
      </label>
      <label>time scale
        <select data-price-window="${esc(p.id)}">
          <option value="3d"${filter.window === "3d" ? " selected" : ""}>3 days</option>
          <option value="7d"${filter.window === "7d" ? " selected" : ""}>7 days</option>
          <option value="30d"${filter.window === "30d" ? " selected" : ""}>30 days</option>
          <option value="all"${filter.window === "all" ? " selected" : ""}>all</option>
        </select>
      </label>
    </div>
    <svg class="price-graph" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(p.names.primary)} price history">
      <line x1="${padX}" y1="${padY + graphH}" x2="${padX + graphW}" y2="${padY + graphH}" class="price-axis"></line>
      <line x1="${padX}" y1="${padY}" x2="${padX}" y2="${padY + graphH}" class="price-axis"></line>
      ${dates
        .map(
          (date, index) => `<g>
            <line x1="${xAt(index)}" y1="${padY}" x2="${xAt(index)}" y2="${padY + graphH}" class="price-grid"></line>
            <text x="${xAt(index)}" y="${height - 6}" text-anchor="middle" class="price-tick">${esc(date.slice(5))}</text>
          </g>`
        )
        .join("")}
      ${series
        .map((item) => {
          const points = item.rows.map((row) => `${xAt(dates.indexOf(row.observed_at))},${yAt(Number(row.price_usd || 0))}`).join(" ");
          return `<g>
            <polyline fill="none" stroke="${item.color}" stroke-width="2.4" stroke-dasharray="${item.dash}" points="${points}"></polyline>
            ${item.rows
              .map((row) => {
                const x = xAt(dates.indexOf(row.observed_at));
                const y = yAt(Number(row.price_usd || 0));
                return `<circle cx="${x}" cy="${y}" r="4.2" fill="${item.color}">
                  <title>${esc(`${item.vendor} | ${item.packageLabel} | $${row.price_usd} | ${row.observed_at}`)}</title>
                </circle>`;
              })
              .join("")}
          </g>`;
        })
        .join("")}
      <text x="${padX - 10}" y="${padY + 10}" text-anchor="end" class="price-tick price-money-tick">$${esc(String(
        maxPrice.toFixed(2)
      ))}</text>
      <text x="${padX - 10}" y="${padY + graphH}" text-anchor="end" class="price-tick price-money-tick">$${esc(String(
        minPrice.toFixed(2)
      ))}</text>
    </svg>
    <div class="price-key">
      ${legendGroups
        .map(
          (group) => `<article class="price-key-group">
            <div class="price-key-vendor">
              <svg class="price-key-swatch" viewBox="0 0 24 8" aria-hidden="true">
                <line x1="0" y1="4" x2="24" y2="4" stroke="${itemSafeColor(group.color)}" stroke-width="2.4"></line>
              </svg>
              <span>${esc(group.vendor)}</span>
            </div>
            <div class="price-key-styles">
              ${group.items
                .map(
                  (item) => `<span class="price-key-style" style="--price-key:${item.color}">
                    <svg class="price-key-swatch" viewBox="0 0 24 8" aria-hidden="true">
                      <line x1="0" y1="4" x2="24" y2="4" stroke="${itemSafeColor(item.color)}" stroke-width="2.4" stroke-dasharray="${esc(
                        item.dash || ""
                      )}"></line>
                    </svg>
                    <small>${esc(item.packageLabel)}</small>
                  </span>`
                )
                .join("")}
            </div>
          </article>`
        )
        .join("")}
    </div>
    <div class="price-calculator">
      <div class="price-calculator-head">
        <p class="eyebrow">Price Calculator</p>
        <span class="muted">Uses the currently selected manufacturer/dose filters and user-entered regimen fields until normalized dosing imports land.</span>
      </div>
      <div class="price-calculator-controls">
        <label>dose amount (${esc(calculatorUnit)})
          <input type="number" min="0" step="0.01" value="${esc(priceFilterState(p.id).calcDoseMg)}" data-price-calc-dose="${esc(
            p.id
          )}" data-focus-key="price-calc-dose-${esc(p.id)}">
        </label>
        <label>doses per week
          <input type="number" min="0" step="0.1" value="${esc(priceFilterState(p.id).calcDosesPerWeek)}" data-price-calc-weekly="${esc(
            p.id
          )}" data-focus-key="price-calc-weekly-${esc(p.id)}">
        </label>
        <label>period length
          <input type="number" min="0" step="1" value="${esc(priceFilterState(p.id).calcPeriodAmount)}" data-price-calc-period-amount="${esc(
            p.id
          )}" data-focus-key="price-calc-period-${esc(p.id)}">
        </label>
        <label>period unit
          <select data-price-calc-period-unit="${esc(p.id)}" data-focus-key="price-calc-unit-${esc(p.id)}">
            <option value="days"${priceFilterState(p.id).calcPeriodUnit === "days" ? " selected" : ""}>days</option>
            <option value="weeks"${priceFilterState(p.id).calcPeriodUnit === "weeks" ? " selected" : ""}>weeks</option>
            <option value="months"${priceFilterState(p.id).calcPeriodUnit === "months" ? " selected" : ""}>months</option>
            <option value="years"${priceFilterState(p.id).calcPeriodUnit === "years" ? " selected" : ""}>years</option>
          </select>
        </label>
      </div>
      ${
        calculator
          ? `<div class="price-calculator-grid">
              <article><span class="review-stat-label">reference product</span><strong>${esc(
                `${calculator.row.vendor} · ${packageLabel(calculator.row)}`
              )}</strong></article>
              <article><span class="review-stat-label">cost per dose</span><strong><span class="money">$${esc(
                calculator.costPerDose.toFixed(2)
              )}</span> / ${esc(calculator.doseAmount.toFixed(2))} ${esc(calculator.doseUnit)}</strong></article>
              <article><span class="review-stat-label">selected period</span><strong><span class="money">$${esc(
                calculator.periodCost.toFixed(2)
              )}</span></strong></article>
              <article><span class="review-stat-label">avg daily / monthly / yearly</span><strong><span class="money">$${esc(
                calculator.dailyCost.toFixed(2)
              )}</span> / <span class="money">$${esc(calculator.monthlyCost.toFixed(2))}</span> / <span class="money">$${esc(
                calculator.yearlyCost.toFixed(2)
              )}</span></strong></article>
            </div>`
          : '<p class="section-note">No price rows are visible for the current manufacturer/dose filter, so the calculator cannot estimate a regimen yet.</p>'
      }
    </div>
  </div>`;
}

function structureSummaryPanel(p) {
  const bestPrice = bestPriceSummary(p.id);
  const bestPriceMarkup = bestPrice
    ? [
        esc(bestPrice.vendor),
        " · ",
        `<span class="money">$${esc(String(bestPrice.priceUsd.toFixed(2)))}</span>`,
        " / ",
        esc(bestPrice.packageLabel),
        " (",
        `<span class="money">$${esc(String(bestPrice.pricePerUnit.toFixed(4)))}</span>`,
        " per ",
        esc(bestPrice.packageUnit),
        ")"
      ].join("")
    : '<span class="muted">No storefront observations loaded yet.</span>';
  return `<div class="structure-summary-box">
    <p class="eyebrow">Dosing And Price Snapshot</p>
    <div class="structure-summary-grid">
      <article>
        <span>dosing</span>
        <strong>${esc(p.tile.dosing.quick || "No dosing summary imported.")}</strong>
      </article>
      <article>
        <span>route</span>
        <strong>${esc(p.tile.dosing.adminRoute || "Pending route import.")}</strong>
      </article>
      <article class="structure-summary-wide">
        <span>best observed price</span>
        <strong>${bestPriceMarkup}</strong>
      </article>
    </div>
  </div>`;
}

function sandboxBanner() {
  return "";
}

function aggregatedStackRisks() {
  const groups = new Map();
  for (const peptide of stackPeptides()) {
    for (const row of peptide.expanded.safetyRisks || []) {
      const key = `${row.system || "unclassified"}::${row.label || "Unlabeled risk"}`;
      const current = groups.get(key) || {
        system: row.system || "unclassified",
        label: row.label || "Unlabeled risk",
        color: row.color || "yellow",
        items: []
      };
      current.color = severityRank(row.color) > severityRank(current.color) ? row.color : current.color;
      current.items.push({ peptide, row });
      groups.set(key, current);
    }
  }
  return [...groups.values()].sort((a, b) => severityRank(b.color) - severityRank(a.color) || b.items.length - a.items.length || a.label.localeCompare(b.label));
}

function stackSearchResults() {
  const query = norm(state.stackSearchQuery);
  return PEPTIDES
    .filter((peptide) => !state.stackIds.includes(peptide.id))
    .filter((peptide) => !query || searchable(peptide).includes(query))
    .slice(0, 24);
}

function conciseList(items, fallback, limit = 3) {
  const values = items.filter(Boolean).slice(0, limit);
  if (!values.length) return `<span class="muted">${esc(fallback)}</span>`;
  return `<ul class="stack-mini-list">${values.map((value) => `<li>${value}</li>`).join("")}</ul>`;
}

function stackMedicalCell(peptide) {
  return `${conciseList(
    peptide.tile.clinicalUses.map((item) => `${esc(item)} ${citationRefsByIds(peptide, sectionCitationIds(peptide, "human"))}`),
    "No clinical-use statement imported."
  )}<span class="stack-evidence-label">${esc(DATA.evidenceTierLabel[peptide.classification.evidenceTier] || "pending")}</span>`;
}

function stackEnhancementCell(peptide) {
  return conciseList(
    peptide.tile.enhancingEffects.map((effect) => {
      const claim = peptide.claims.find((item) => item.id === effect.claimRef);
      return `${esc(effect.label)} ${symbols(effect.symbols || [])} ${claim ? citationRefsByIds(peptide, claim.citationIds) : ""}`;
    }),
    "No enhancement-benefit rows imported."
  );
}

function stackRiskCell(peptide) {
  return conciseList(
    (peptide.expanded.safetyRisks || []).map((row) => `${esc(row.label)}: ${esc(row.harmSummary || row.helpSummary || "")} ${citationRefsByIds(peptide, row.citationIds)}`),
    "No risk rows imported."
  );
}

function stackDosingCell(peptide) {
  return `<div class="stack-dosing-cell">
    <p>${esc(peptide.tile.dosing.quick || "No dosing summary imported.")}</p>
    <span class="stack-evidence-label">${esc(peptide.tile.dosing.adminRoute || "route pending")}</span>
  </div>`;
}

function stackCostCell(peptide) {
  const best = bestPriceSummary(peptide.id);
  if (!best) return '<span class="muted">No price rows loaded.</span>';
  return `<div class="stack-cost-cell">
    <strong><span class="money">$${esc(best.priceUsd.toFixed(2))}</span></strong>
    <span>${esc(best.vendor)} · ${esc(best.packageLabel)}</span>
    <span><span class="money">$${esc(best.pricePerUnit.toFixed(4))}</span> per ${esc(best.packageUnit)}</span>
  </div>`;
}

function stackSelectedPeptideChips(selected) {
  if (!selected.length) return '<span class="muted">Add peptides from any detail view or with the + button below to start a stack review.</span>';
  return selected
    .map(
      (peptide) => `<span class="stack-chip-group">
        <button class="tag stack-tag ${state.stackFocusId === peptide.id ? "active" : ""}" type="button" data-stack-focus="${esc(peptide.id)}">${formatPeptideName(
          peptide.names.primary
        )}</button>
        <button class="stack-remove-button" type="button" data-stack-remove="${esc(peptide.id)}" aria-label="Remove ${esc(peptide.names.primary)} from stack">x</button>
      </span>`
    )
    .join("");
}

function stackComparisonTable(selected) {
  if (!selected.length) return "";
  return `<div class="stack-compare-shell">
    <table class="stack-compare-table">
      <thead>
        <tr>
          <th>Comparison</th>
          ${selected.map((peptide) => `<th>${formatPeptideName(peptide.names.primary)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        <tr>
          <th>3D model</th>
          ${selected
            .map(
              (peptide) =>
                `<td><div class="stack-structure-slot">${structureViewerMarkup(
                  peptide.id,
                  peptide.names.primary,
                  "modal-3d",
                  "stack-structure-surface"
                )}</div></td>`
            )
            .join("")}
        </tr>
        <tr>
          <th>Medical benefit</th>
          ${selected.map((peptide) => `<td>${stackMedicalCell(peptide)}</td>`).join("")}
        </tr>
        <tr>
          <th>Enhancement benefit</th>
          ${selected.map((peptide) => `<td>${stackEnhancementCell(peptide)}</td>`).join("")}
        </tr>
        <tr>
          <th>Risks & side effects</th>
          ${selected.map((peptide) => `<td>${stackRiskCell(peptide)}</td>`).join("")}
        </tr>
        <tr>
          <th>Dosing information</th>
          ${selected.map((peptide) => `<td>${stackDosingCell(peptide)}</td>`).join("")}
        </tr>
        <tr>
          <th>Cost per package</th>
          ${selected.map((peptide) => `<td>${stackCostCell(peptide)}</td>`).join("")}
        </tr>
        <tr>
          <th>Cost per regimen period</th>
          ${selected.map(() => `<td><span class="muted">Activates once normalized dosing rows are imported.</span></td>`).join("")}
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <th>Total stack cost</th>
          <td colspan="${selected.length}"><span class="muted">Regimen-total cost activates after dosing normalization lands.</span></td>
        </tr>
      </tfoot>
    </table>
  </div>`;
}

function stackDrawer() {
  if (!state.stackOpen) return "";
  const selected = stackPeptides();
  const risks = aggregatedStackRisks();
  return `<section class="detail-backdrop" data-close-stack>
    <article class="detail stack-drawer" role="dialog" aria-modal="true" aria-label="Build stack review">
      <div class="article-shell">
        <header class="article-head">
          <div>
            <p class="eyebrow">Build Stack</p>
            <h2 class="name-display">Build Stack</h2>
            <p>Deterministic aggregation from the current atlas safety rows. This is a review tool, not medical advice.</p>
          </div>
          <div class="article-head-actions">
            <button class="icon" data-close-stack-button aria-label="Close stack review">x</button>
          </div>
        </header>
        <section class="article-section">
          <h3>Selected Peptides</h3>
          <div class="stack-picker-row">
            <div class="tag-flow">${stackSelectedPeptideChips(selected)}</div>
            <button class="header-button stack-add-button" type="button" data-stack-search-toggle>${state.stackSearchOpen ? "Close +" : "+ Add"}</button>
          </div>
          ${
            state.stackSearchOpen
              ? `<div class="stack-search-panel">
                  <input type="search" data-stack-search data-focus-key="stack-search" placeholder="Search peptides to add" value="${esc(state.stackSearchQuery)}">
                  <div class="stack-search-results">
                    ${stackSearchResults()
                      .map(
                        (peptide) =>
                          `<button class="stack-search-result" type="button" data-stack-pick="${esc(peptide.id)}">
                            <strong>${formatPeptideName(peptide.names.primary)}</strong>
                            <small>${esc([peptide.id, ...peptide.names.aliases].filter(Boolean).slice(0, 3).join(" / "))}</small>
                          </button>`
                      )
                      .join("") || '<span class="muted">No matching peptides.</span>'}
                  </div>
                </div>`
              : ""
          }
        </section>
        <section class="article-section">
          <h3>Stack Summary Table</h3>
          <p class="section-note">Cost-per-regimen rows are scaffolded now and become fully quantitative when normalized dosing imports land.</p>
          ${stackComparisonTable(selected) || '<span class="muted">No stack selected yet.</span>'}
        </section>
        <section class="article-section">
          <h3>Aggregated Side-Effect Watchlist</h3>
          <table>
            <thead><tr><th>Risk axis</th><th>Peptides</th><th>Why watch it</th></tr></thead>
            <tbody>${
              risks.length
                ? risks
                    .map(
                      (group) => `<tr>
                        <td>${riskPill(group.label, group.color)}</td>
                        <td>${esc(group.items.map((item) => item.peptide.names.primary).join(" / "))}</td>
                        <td>${group.items
                          .map(
                            (item) =>
                              `<div class="stack-risk-item"><strong>${esc(item.peptide.names.primary)}:</strong> ${esc(
                                item.row.harmSummary || "No harm summary extracted."
                              )} ${citationRefsByIds(item.peptide, item.row.citationIds)}</div>`
                          )
                          .join("")}</td>
                      </tr>`
                    )
                    .join("")
                : '<tr><td colspan="3">No stack selected yet.</td></tr>'
            }</tbody>
          </table>
        </section>
      </div>
    </article>
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
  const inStack = state.stackIds.includes(p.id);
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
            <button class="header-button" data-stack-action="${esc(p.id)}" aria-label="${inStack ? "Remove from" : "Add to"} build stack">${
              inStack ? "In stack" : "Add to stack"
            }</button>
            <button class="header-button" data-share-link="${esc(p.id)}" aria-label="Share link to ${esc(p.names.primary)}">Share</button>
            <button class="header-button" data-copy-link="${esc(p.id)}" aria-label="Copy link to ${esc(p.names.primary)}">Copy link</button>
            <button class="icon" data-close aria-label="Close article">x</button>
          </div>
        </header>
        <section class="article-section intro">
          <div>
            <section class="intro-overview-box tag-block">
              <h3>Overview</h3>
              <p><span class="label-mono">MECHANISM:</span> ${esc(define(p.tile.mechanismSummary))}</p>
              <p><span class="label-mono">LOCALIZATION:</span> ${esc(define(p.tile.localization))}</p>
              <p><span class="label-mono">CLINICAL CONTEXT:</span> ${esc(define(p.tile.clinicalUses.join(" ")))}</p>
            </section>
            ${criticalEffectsPanel(p, define)}
            ${chemicalIdentityPanel(p)}
          </div>
          <aside>
            ${structurePanel(p)}
            ${structureSupportPanel(p)}
          </aside>
        </section>
        ${sectionFrame({
          title: "Clinical And Enhancement Use",
          body: `<table>
            <tbody>
              <tr><th>Medical / clinical use</th><td>${esc(define(p.tile.clinicalUses.join(" ")))}</td></tr>
              <tr><th>Enhancement / common-use context</th><td>${esc(
                define(p.expanded.anecdotalUse.length ? p.expanded.anecdotalUse.join(" ") : "No enhancement/common-use statement imported.")
              )}</td></tr>
              <tr><th>Dosing context</th><td>${esc(define(`${p.tile.dosing.quick} ${p.tile.dosing.adminRoute}`))}</td></tr>
              <tr><th>Safety</th><td>${esc(define(`${safetyText} ${p.tile.sideEffects.join(" ")}`))}</td></tr>
            </tbody>
          </table>`
        })}
        ${safetyPanel(p, define)}
        ${enhancementPanel(p, define)}
        ${interactableBiologySection(p, define)}
        ${signalingSection(p, define)}
        ${regulatoryPkPanel(p)}
        ${sectionFrame({
          title: "Evidence And Article Notes",
          body: `<table>
            <tbody>
              <tr><th>Human evidence</th><td>${esc(humanText)} ${citationRefsByIds(p, sectionCitationIds(p, "human"))}</td></tr>
              <tr><th>Animal evidence</th><td>${esc(animalText)} ${citationRefsByIds(p, sectionCitationIds(p, "animal"))}</td></tr>
              <tr><th>Mechanism detail</th><td>${esc(mechanismText)} ${citationRefsByIds(p, sectionCitationIds(p, "mechanism"))}</td></tr>
              <tr><th>Missing evidence</th><td>${esc(define(p.expanded.missingEvidence.join("; ") || "No missing-evidence list yet."))}</td></tr>
            </tbody>
          </table>`
        })}
        ${sectionFrame({
          title: "Cytokines, Interleukins, And Markers",
          body: `<table>
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
          </table>`
        })}
        ${evidenceTables(p, define)}
        ${qualityReviewPanel(p)}
        ${sectionFrame({
          title: "Manufacturers, Vendor Data, And Cost",
          body: `<table>
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
          </table>`
        })}
        ${sectionFrame({
          title: "Moderator Verification",
          body: `<table>
            <tbody>
              <tr><th>Status</th><td>${esc(moderationLabel(p.moderation.status))}</td></tr>
              <tr><th>Reviewer</th><td>${esc(p.moderation.reviewer || "No human moderator assigned yet.")}</td></tr>
              <tr><th>Write-up</th><td>${esc(p.moderation.verificationWriteup || "Future mod class can verify citations, add a structured write-up, and leave rationale for other mods.")}</td></tr>
              <tr><th>Stale after</th><td>${esc(p.moderation.staleAfter || "not set")}</td></tr>
            </tbody>
          </table>`
        })}
        ${sectionFrame({
          title: "Citations",
          className: "citations-section",
          body: `<table>
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
          </table>`
        })}
      </div>
    </article>
  </section>`;
}

function hero() {
  return `<section class="hero">
    <div>
      <button class="brand-title-button ${state.structureMode !== "none" ? "active" : ""}" type="button" data-toggle-brand-mode aria-pressed="${
        state.structureMode === "3d" ? "true" : "false"
      }" aria-label="Cycle structure display mode">
        <h1 class="brand-title">${BRAND}</h1>
        <span class="brand-mode-indicator">${esc(structureModeLabel(state.structureMode))}</span>
      </button>
    </div>
  </section>`;
}

function sideRail(direction) {
  const glyphs = "PEPTIDE  SIGNALING  ATLAS  ".split("");
  const repeated = Array.from({ length: 8 }, () => glyphs)
    .flat()
    .map((char) => `<span>${esc(char === " " ? " " : char)}</span>`)
    .join("");
  return `<div class="side-rail side-rail-${esc(direction)}" aria-hidden="true">
    <div class="side-rail-track">${repeated}</div>
  </div>`;
}

function atlasFrameOpen() {
  return `<section class="atlas-frame">
    ${sideRail("left")}${sideRail("right")}`;
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
    <button class="bibliography-button ${state.stackOpen ? "active" : ""}" data-toggle-stack aria-pressed="${state.stackOpen ? "true" : "false"}" aria-label="Open build stack">
      Stack (${state.stackIds.length})
    </button>
    <button class="bibliography-button help-toggle ${state.helpOpen ? "active" : ""}" data-open-help aria-pressed="${
      state.helpOpen ? "true" : "false"
    }" aria-label="Open site help" title="Site help">?</button>
    <button class="bibliography-button info-toggle ${state.infoOpen ? "active" : ""}" data-open-info aria-pressed="${
      state.infoOpen ? "true" : "false"
    }" aria-label="About this site" title="About this site">i</button>
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
  syncTutorialState();
  const focus = captureFocus();
  const openPanels = captureOpenPanels();
  const liveDetailScroll = state.selected ? app.querySelector(".detail")?.scrollTop ?? null : null;
  const categories = ["All", ...new Set(PEPTIDES.map((p) => p.category))];
  const peptides = filteredPeptides();
  refreshCitationRegistry();
  app.innerHTML = `<div class="app-shell">
    ${lineFeature()}${hero()}${sandboxBanner()}
    ${atlasFrameOpen()}
    ${toolbar(categories)}
    <section class="tiles">${tilesMarkup(peptides)}</section>
    ${atlasFrameClose()}
    ${detail(state.selected)}
    ${stackDrawer()}
    ${structureModal()}
    ${relatedPanel()}
    ${keyModal()}
    ${mobileWarningModal()}
    ${helpModal()}
    ${infoModal()}
    ${tutorialOverlay()}
    ${bibliographyDrawer()}
    ${noticeToast()}
  </div>`;
  restoreOpenPanels(openPanels);
  restoreFocus(focus);
  if (state.selected) {
    const detailElement = app.querySelector(".detail");
    const scrollTop = pendingDetailScrollTop ?? liveDetailScroll;
    if (detailElement && typeof scrollTop === "number") detailElement.scrollTop = scrollTop;
  }
  pendingDetailScrollTop = null;
  initStructureViewers();
  updateTutorialHighlight();
}

function captureOpenPanels() {
  return new Set(
    [...app.querySelectorAll("details[data-panel-key][open]")]
      .map((node) => node.getAttribute("data-panel-key"))
      .filter(Boolean)
  );
}

function restoreOpenPanels(openPanels) {
  if (!openPanels?.size) return;
  [...app.querySelectorAll("details[data-panel-key]")].forEach((node) => {
    const key = node.getAttribute("data-panel-key");
    if (!key) return;
    if (openPanels.has(key)) node.open = true;
  });
}

function disconnectStructureViewerObserver() {
  if (!structureViewerObserver) return;
  structureViewerObserver.disconnect();
  structureViewerObserver = null;
}

function loadStructureModelText(src) {
  if (structureModelTextCache.has(src)) return structureModelTextCache.get(src);
  const pending = fetch(src).then((response) => {
    if (!response.ok) throw new Error(`Model fetch failed with ${response.status}.`);
    return response.text();
  });
  structureModelTextCache.set(src, pending);
  return pending;
}

function controllerForShell(shell) {
  for (const controller of structureViewerControllers) {
    if (controller.shell === shell) return controller;
  }
  return null;
}

function setControllerSpinning(controller, value) {
  if (!controller) return;
  controller.shouldSpin = value;
  controller.lastTimestamp = performance.now();
  scheduleStructureAnimation();
}

function zoomFactorForSurface(surface) {
  if (!surface) return 1.2;
  if (surface.classList.contains("tile-structure-surface")) return 0.99;
  if (surface.classList.contains("structure-panel-surface")) return 1.4;
  if (surface.classList.contains("structure-modal-surface")) return 1.28;
  return 1.2;
}

function syncViewerLayout(controller) {
  if (!controller || !controller.shell.isConnected) return;
  controller.viewer.resize();
  controller.viewer.center();
  controller.viewer.zoomTo();
  controller.viewer.zoom(controller.zoomFactor || 1.2);
  controller.viewer.render();
}

function scheduleStructureAnimation() {
  if (structureAnimationFrame !== null || !structureViewerControllers.size) return;
  structureAnimationFrame = requestAnimationFrame(stepStructureAnimation);
}

function stepStructureAnimation(timestamp) {
  structureAnimationFrame = null;
  let active = false;
  for (const controller of [...structureViewerControllers]) {
    if (!controller.shell.isConnected) {
      structureViewerControllers.delete(controller);
      continue;
    }
    if (!controller.shouldSpin) continue;
    const delta = Math.min(40, timestamp - controller.lastTimestamp);
    controller.lastTimestamp = timestamp;
    controller.viewer.rotate(delta * STRUCTURE_ROTATION_SPEED, "y");
    controller.viewer.render();
    active = true;
  }
  if (active) scheduleStructureAnimation();
}

function ensureStructureViewerScript() {
  if (window.$3Dmol) return Promise.resolve(window.$3Dmol);
  if (structureViewerLoadPromise) return structureViewerLoadPromise;
  structureViewerLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = STRUCTURE_VIEWER_SCRIPT;
    script.async = true;
    script.onload = () => {
      if (window.$3Dmol) {
        resolve(window.$3Dmol);
        return;
      }
      reject(new Error("3Dmol loaded without exposing $3Dmol."));
    };
    script.onerror = () => reject(new Error(`Unable to load ${STRUCTURE_VIEWER_SCRIPT}.`));
    document.head.appendChild(script);
  });
  return structureViewerLoadPromise;
}

function revealStructureFallback(surface) {
  if (!surface) return;
  const fallback = surface.querySelector(".structure-viewer-fallback");
  const shell = surface.querySelector(".structure-viewer-shell");
  if (shell) shell.hidden = true;
  if (fallback) fallback.hidden = false;
}

function bindStructureSurface(surface) {
  if (!surface || surface.dataset.surfaceBound === "true") return;
  surface.dataset.surfaceBound = "true";
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let dragged = false;
  const shell = surface.querySelector("[data-structure-viewer]");
  const finishPointer = (event) => {
    if (pointerId === null || (event && event.pointerId !== undefined && event.pointerId !== pointerId)) return;
    pointerId = null;
    if (dragged) surface.dataset.structureDragged = "true";
    setControllerSpinning(controllerForShell(shell), true);
  };
  surface.addEventListener("pointerdown", (event) => {
    if (!(event.target instanceof Element)) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    dragged = false;
    surface.dataset.structureDragged = "false";
    setControllerSpinning(controllerForShell(shell), false);
  });
  surface.addEventListener("pointermove", (event) => {
    if (pointerId === null || event.pointerId !== pointerId) return;
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 6) dragged = true;
  });
  surface.addEventListener("pointerup", finishPointer);
  surface.addEventListener("pointercancel", finishPointer);
}

async function initStructureViewerShell(shell) {
  if (!shell || shell.dataset.viewerState === "ready" || shell.dataset.viewerState === "loading") return;
  const surface = shell.closest(".structure-surface");
  const zoomFactor = zoomFactorForSurface(surface);
  shell.dataset.viewerState = "loading";
  try {
    shell.textContent = "Loading 3D model...";
    const [$3Dmol, modelData] = await Promise.all([ensureStructureViewerScript(), loadStructureModelText(shell.dataset.modelSrc || "")]);
    if (!shell.isConnected) return;
    shell.textContent = "";
    const viewer = $3Dmol.createViewer(shell, { backgroundColor: "rgba(0,0,0,0)" });
    viewer.addModel(modelData, shell.dataset.modelFormat || "sdf");
    viewer.setStyle({}, { stick: { radius: 0.18 }, sphere: { scale: 0.26 } });
    viewer.center();
    viewer.zoomTo();
    viewer.zoom(zoomFactor);
    viewer.rotate(18, "y");
    viewer.rotate(10, "x");
    viewer.resize();
    viewer.center();
    viewer.zoomTo();
    viewer.zoom(zoomFactor);
    viewer.render();
    const controller = {
      shell,
      viewer,
      zoomFactor,
      shouldSpin: true,
      lastTimestamp: performance.now()
    };
    structureViewerControllers.add(controller);
    shell.dataset.viewerState = "ready";
    bindStructureSurface(surface);
    requestAnimationFrame(() => requestAnimationFrame(() => syncViewerLayout(controller)));
    scheduleStructureAnimation();
  } catch (error) {
    console.error(error);
    if (surface) revealStructureFallback(surface);
    shell.dataset.viewerState = "error";
  }
}

function initStructureViewers() {
  disconnectStructureViewerObserver();
  const shells = [...app.querySelectorAll("[data-structure-viewer]")];
  const surfaces = [...app.querySelectorAll(".structure-surface")];
  surfaces.forEach(bindStructureSurface);
  if (!shells.length) return;
  if (!("IntersectionObserver" in window)) {
    shells.forEach(initStructureViewerShell);
    return;
  }
  structureViewerObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const shell = entry.target;
        if (!(shell instanceof HTMLElement)) return;
        const controller = controllerForShell(shell);
        if (!entry.isIntersecting) {
          setControllerSpinning(controller, false);
          return;
        }
        initStructureViewerShell(shell);
        setControllerSpinning(controllerForShell(shell), true);
      });
    },
    { rootMargin: "220px 0px" }
  );
  shells.forEach((shell) => structureViewerObserver.observe(shell));
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
  if (event.target.matches("[data-stack-search]")) {
    state.stackSearchQuery = event.target.value;
    render();
  }
  if (event.target.matches("[data-price-calc-dose]")) {
    setPriceFilter(event.target.dataset.priceCalcDose, "calcDoseMg", event.target.value);
    render();
  }
  if (event.target.matches("[data-price-calc-weekly]")) {
    setPriceFilter(event.target.dataset.priceCalcWeekly, "calcDosesPerWeek", event.target.value);
    render();
  }
  if (event.target.matches("[data-price-calc-period-amount]")) {
    setPriceFilter(event.target.dataset.priceCalcPeriodAmount, "calcPeriodAmount", event.target.value);
    render();
  }
});

app.addEventListener("change", (event) => {
  if (event.target.matches("[data-category]")) state.category = event.target.value;
  if (event.target.matches("[data-sort]")) state.sort = event.target.value;
  if (event.target.matches("[data-study-filter]")) state.studyFilter = event.target.value;
  if (event.target.matches("[data-price-vendor]")) setPriceFilter(event.target.dataset.priceVendor, "vendor", event.target.value);
  if (event.target.matches("[data-price-dose]")) setPriceFilter(event.target.dataset.priceDose, "dose", event.target.value);
  if (event.target.matches("[data-price-window]")) setPriceFilter(event.target.dataset.priceWindow, "window", event.target.value);
  if (event.target.matches("[data-price-calc-period-unit]")) {
    setPriceFilter(event.target.dataset.priceCalcPeriodUnit, "calcPeriodUnit", event.target.value);
  }
  render();
});

app.addEventListener("toggle", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLDetailsElement)) return;
  if (!target.classList.contains("collapsible-section")) return;
  const nested = [...target.querySelectorAll(".section-body details")];
  nested.forEach((detail) => {
    if (detail !== target) detail.open = target.open;
  });
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
  const toggleStack = target.closest("[data-toggle-stack]");
  const stackAction = target.closest("[data-stack-action]");
  const stackFocus = target.closest("[data-stack-focus]");
  const stackRemove = target.closest("[data-stack-remove]");
  const stackSearchToggle = target.closest("[data-stack-search-toggle]");
  const stackPick = target.closest("[data-stack-pick]");
  const closeStackBackdrop = target.closest("[data-close-stack]");
  const closeStackButton = target.closest("[data-close-stack-button]");
  const openHelp = target.closest("[data-open-help]");
  const closeHelpBackdrop = target.closest("[data-close-help]");
  const closeHelpButton = target.closest("[data-close-help-button]");
  const startTutorial = target.closest("[data-start-tutorial]");
  const closeTutorialBackdrop = target.closest("[data-close-tutorial]");
  const tutorialNav = target.closest("[data-tutorial-nav]");
  const openInfo = target.closest("[data-open-info]");
  const closeInfoBackdrop = target.closest("[data-close-info]");
  const closeInfoButton = target.closest("[data-close-info-button]");
  const bibliographyClose = target.closest("[data-close-bibliography-button]");
  const structureAction = target.closest("[data-structure-action]");
  const openStructure = target.closest("[data-open-structure]");
  const closeStructure = target.closest("[data-close-structure-button]");
  const structureBackdrop = target.closest("[data-close-structure-modal]");
  const keyOpen = target.closest("[data-open-key]");
  const keyBackdrop = target.closest("[data-close-key-modal]");
  const keyClose = target.closest("[data-close-key-button]");
  const relatedBackdrop = target.closest("[data-close-related-modal]");
  const mobileWarningBackdrop = target.closest("[data-close-mobile-warning]");
  const dismissMobileWarning = target.closest("[data-dismiss-mobile-warning]");
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

  if (toggleStack) {
    state.stackOpen = !state.stackOpen;
    if (state.stackOpen && state.stackIds.length && !state.stackFocusId) state.stackFocusId = state.stackIds[0];
    render();
    return;
  }

  if (stackAction) {
    toggleStackPeptide(stackAction.dataset.stackAction);
    if (!state.stackOpen) state.stackOpen = true;
    render();
    return;
  }

  if (stackFocus) {
    state.stackFocusId = stackFocus.dataset.stackFocus;
    render();
    return;
  }

  if (stackRemove) {
    toggleStackPeptide(stackRemove.dataset.stackRemove);
    render();
    return;
  }

  if (stackSearchToggle) {
    state.stackSearchOpen = !state.stackSearchOpen;
    state.stackSearchQuery = "";
    render();
    return;
  }

  if (stackPick) {
    toggleStackPeptide(stackPick.dataset.stackPick);
    state.stackFocusId = stackPick.dataset.stackPick;
    state.stackSearchOpen = false;
    state.stackSearchQuery = "";
    if (!state.stackOpen) state.stackOpen = true;
    render();
    return;
  }

  if (openInfo) {
    state.infoOpen = true;
    render();
    return;
  }

  if (openHelp) {
    state.tutorialOpen = true;
    state.tutorialStep = 0;
    render();
    return;
  }

  if (startTutorial) {
    state.helpOpen = false;
    state.tutorialOpen = true;
    state.tutorialStep = 0;
    render();
    return;
  }

  if (closeStackButton || (closeStackBackdrop && target === closeStackBackdrop)) {
    state.stackOpen = false;
    render();
    return;
  }

  if (closeHelpButton || (closeHelpBackdrop && target === closeHelpBackdrop)) {
    state.helpOpen = false;
    render();
    return;
  }

  if (closeInfoButton || (closeInfoBackdrop && target === closeInfoBackdrop)) {
    state.infoOpen = false;
    render();
    return;
  }

  if (tutorialNav) {
    const action = tutorialNav.dataset.tutorialNav;
    if (action === "prev") state.tutorialStep = Math.max(0, state.tutorialStep - 1);
    if (action === "next") state.tutorialStep = Math.min(tutorialSteps().length - 1, state.tutorialStep + 1);
    if (action === "finish") {
      resetToGridState();
      state.tutorialOpen = false;
      state.tutorialStep = 0;
      syncHistory("grid");
      render();
      return;
    }
    render();
    return;
  }

  if (closeTutorialBackdrop && target === closeTutorialBackdrop) {
    state.tutorialOpen = false;
    state.tutorialStep = 0;
    render();
    return;
  }

  if (toggleBrandMode) {
    state.structureMode = nextStructureMode(state.structureMode);
    render();
    return;
  }

  if (bibliographyClose || (bibliographyBackdrop && target === bibliographyBackdrop)) {
    state.bibliographyOpen = false;
    render();
    return;
  }

  if (structureAction) {
    if (structureAction.dataset.structureDragged === "true") {
      structureAction.dataset.structureDragged = "false";
      return;
    }
    const action = structureAction.dataset.structureAction;
    const peptideId = structureAction.dataset.structureId;
    const peptide = peptideId ? PEPTIDES.find((item) => item.id === peptideId) : null;
    if (!action || action === "noop") return;
    if (action === "expand" && peptide) {
      openDetail(peptide.id);
      return;
    }
    if ((action === "modal-3d" || action === "modal-2d") && peptide) {
      pendingDetailScrollTop = app.querySelector(".detail")?.scrollTop ?? pendingDetailScrollTop ?? 0;
      state.structureZoom = { id: peptide.id, name: peptide.names.primary, kind: action === "modal-2d" ? "2d" : "3d" };
      render();
      return;
    }
  }

  if (openStructure) {
    pendingDetailScrollTop = app.querySelector(".detail")?.scrollTop ?? pendingDetailScrollTop ?? 0;
    const peptide = PEPTIDES.find((item) => item.id === openStructure.dataset.openStructure);
    if (peptide) {
      state.structureZoom = { id: peptide.id, name: peptide.names.primary, kind: "3d" };
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
    const peptide = PEPTIDES.find((item) => item.id === peptideId);
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

  if (dismissMobileWarning || (mobileWarningBackdrop && target === mobileWarningBackdrop)) {
    markMobileWarningSeen();
    state.mobileWarningOpen = false;
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
    if (state.stackOpen) {
      state.stackOpen = false;
      render();
      return;
    }
    if (state.infoOpen) {
      state.infoOpen = false;
      render();
      return;
    }
    if (state.helpOpen) {
      state.helpOpen = false;
      render();
      return;
    }
    if (state.tutorialOpen) {
      state.tutorialOpen = false;
      state.tutorialStep = 0;
      render();
      return;
    }
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
