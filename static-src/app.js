const DATA = window.PEPTIDE_ATLAS_DATA;
const BRAND = "peptocopeia";
const app = document.getElementById("app");

const defaultState = {
  query: "",
  category: "All",
  sort: "random",
  selected: null,
  tag: null,
  keySymbol: null,
  studyFilter: "all",
  bibliographyOpen: false,
  lineFeature: true,
  brandAlt: false
};

let state = { ...defaultState };
const wikiCache = new Map();
const wikiPending = new Set();
let citationRegistry = { citations: [], index: new Map() };
let pendingDetailScrollTop = null;
const RANDOM_ORDER = new Map(
  [...DATA.peptides.map((peptide) => peptide.id)]
    .sort(() => Math.random() - 0.5)
    .map((id, index) => [id, index])
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

function tag(type, value, sy = [], sourcePeptideId = "") {
  return `<span class="tag-cluster">
    <button class="tag tag-${esc(type)}" data-tag-type="${esc(type)}" data-tag-value="${esc(value)}" data-tag-source="${esc(sourcePeptideId)}">
      ${esc(value)}
    </button>
    ${sy.length ? symbols(sy) : ""}
  </span>`;
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
  state = { ...defaultState, brandAlt: state.brandAlt };
}

function syncHistory(view = "grid") {
  if (typeof window === "undefined") return;
  const nextState = view === "detail" && state.selected ? { view: "detail", peptideId: state.selected.id } : { view: "grid" };
  if (history.state?.view === nextState.view && history.state?.peptideId === nextState.peptideId) return;
  if (view === "detail") {
    history.pushState(nextState, "", window.location.pathname);
  } else {
    history.replaceState(nextState, "", window.location.pathname);
  }
}

function openDetail(peptideId) {
  state.selected = DATA.peptides.find((p) => p.id === peptideId) || null;
  state.tag = null;
  pendingDetailScrollTop = 0;
  syncHistory("detail");
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

async function fetchWikiSummary(tagState) {
  if (!tagState) return;
  const cacheKey = `${tagState.type}:${tagState.value}`;
  if (wikiCache.has(cacheKey) || wikiPending.has(cacheKey)) return;
  wikiPending.add(cacheKey);
  render();
  const query = infoQueryForTag(tagState);
  try {
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`
    );
    const searchJson = await searchRes.json();
    const title = searchJson?.query?.search?.[0]?.title || query;
    const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    const summaryJson = await summaryRes.json();
    wikiCache.set(cacheKey, {
      title: summaryJson?.title || title,
      extract: summaryJson?.extract || "Wikipedia summary unavailable for this term.",
      url: summaryJson?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`
    });
  } catch {
    wikiCache.set(cacheKey, {
      title: query,
      extract: "Wikipedia summary unavailable for this term.",
      url: null
    });
  } finally {
    wikiPending.delete(cacheKey);
    render();
  }
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

function signalingSection(p) {
  const chains = p.biology.cascades.length
    ? p.biology.cascades
    : [{ category: "mechanism", steps: [p.classification.peptideClass, p.classification.mechanismFamily, "clinical effect requires extraction"], symbols: ["?"] }];
  const summarySteps = chains[0]?.steps || [p.names.primary, p.classification.mechanismFamily, "effect context pending"];
  return `<section class="article-section">
    <h3>Physiological Pathways</h3>
    <p class="section-note">${esc(p.expanded.mechanismDetail)}</p>
    <div class="pathway-summary">
      <p class="eyebrow">summary mechanism ${symbols(chains[0]?.symbols || ["?"])}</p>
      <div class="signal-chain compact">
        ${summarySteps
          .map(
            (step, index) =>
              `${index ? '<span class="signal-arrow">-></span>' : ""}<span class="signal-node"><i class="signal-step-index">${index + 1}</i><span>${esc(step)}</span></span>`
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
            <p class="pathway-description">${esc(description)}</p>
            <div class="signal-chain">
              ${chain.steps
                .map(
                  (step, index) =>
                    `${index ? '<span class="signal-arrow">-></span>' : ""}<span class="signal-node"><i class="signal-step-index">${index + 1}</i><span>${esc(step)}</span></span>`
                )
                .join("")}
            </div>
            <table class="pathway-table">
              <thead><tr><th>Stage</th><th>Node</th><th>Functional note</th></tr></thead>
              <tbody>${chain.steps
                .map(
                  (step, index) => `<tr>
                    <td>${esc(stepRole(index, chain.steps.length))}</td>
                    <td>${esc(step)}</td>
                    <td>${esc(describeStep(chain, step, index, chain.steps.length))}</td>
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

function studyRows(p, speciesGroup) {
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
        <td>${esc(population)}</td>
        <td>${esc(claim.sampleSize || "n pending extraction")}</td>
        <td>${esc(protocol)}</td>
        <td>${esc(claim.value)} ${symbols(claim.symbols)}</td>
      </tr>`;
    })
    .join("");
}

function evidenceTables(p) {
  return `<section class="article-section">
    <h3>Supporting Studies</h3>
    <h4>Human Studies</h4>
    <table>
      <thead><tr><th>Study</th><th>Population</th><th>n</th><th>Protocol</th><th>Notable results, stated narrowly</th></tr></thead>
      <tbody>${studyRows(p, "human")}</tbody>
    </table>
    <h4>Animal / Preclinical Studies</h4>
    <table>
      <thead><tr><th>Study</th><th>Population / model</th><th>n</th><th>Protocol</th><th>Notable results, stated narrowly</th></tr></thead>
      <tbody>${studyRows(p, "animal")}</tbody>
    </table>
    <h4>Anecdotal / Common-Use Reports</h4>
    <table>
      <thead><tr><th>Claim type</th><th>Display rule</th><th>Current text</th></tr></thead>
      <tbody><tr><td>Non-peer-reviewed / common-use</td><td>Never displayed as efficacy or safety evidence.</td><td>${esc(
        p.expanded.anecdotalUse.length ? p.expanded.anecdotalUse.join(" ") : "No anecdotal/common-use statement imported."
      )}</td></tr></tbody>
    </table>
  </section>`;
}

function safetyPanel(p) {
  const rows = p.expanded.safetyRisks || [];
  return `<section class="article-section">
    <h3>Safety Risks</h3>
    <p class="section-note">${esc(p.expanded.safetyDetail)}</p>
    <table>
      <thead><tr><th>Organ system</th><th>Potential help</th><th>Potential harm</th></tr></thead>
      <tbody>${
        rows.length
          ? rows
              .map(
                (row) => `<tr>
                  <td><span class="organ-pill" style="--organ-color:${esc(row.color)}"><span class="organ-dot"></span>${esc(row.label)}</span></td>
                  <td>${esc(row.helpSummary || "No organ-specific benefit extracted.")} ${citationRefsByIds(p, row.citationIds)}</td>
                  <td>${esc(row.harmSummary || "No organ-specific harm extracted.")} ${citationRefsByIds(p, row.citationIds)}</td>
                </tr>`
              )
              .join("")
          : '<tr><td colspan="3">Organ-specific safety curation is still pending for this peptide.</td></tr>'
      }</tbody>
    </table>
  </section>`;
}

function enhancementPanel(p) {
  const item = p.expanded.enhancementPotential;
  return `<section class="article-section">
    <h3>Enhancement Potential</h3>
    <table>
      <tbody>${
        item
          ? `<tr><th>Overview</th><td>${esc(item.summary)} ${citationRefsByIds(p, item.citationIds)}</td></tr>
             <tr><th>Caveat</th><td>${esc(item.caveat)}</td></tr>`
          : `<tr><th>Overview</th><td>${esc(
              p.expanded.anecdotalUse.length
                ? p.expanded.anecdotalUse.join(" ")
                : "No enhancement-specific curation has been extracted yet."
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

function keyModal() {
  if (!state.keySymbol) return "";
  const reviewMode = state.keySymbol === "review";
  return `<section class="key-backdrop" data-close-key-modal>
    <aside class="key-modal" aria-label="Evidence key">
      <header>
        <div>
          <p class="eyebrow">key</p>
          <h3>${reviewMode ? "Verification status" : "Evidence symbol"}</h3>
        </div>
        <button class="icon" data-close-key-button aria-label="Close key">x</button>
      </header>
      ${
        reviewMode
          ? `<div class="key-grid">
              <div class="key-row"><span class="verify pending"></span><div><strong>Yellow dot</strong><p>Model-drafted or pending human/mod verification.</p></div></div>
              <div class="key-row"><span class="verify ok"></span><div><strong>Green dot</strong><p>A moderator has verified the article or claim set.</p></div></div>
            </div>`
          : `<div class="key-grid">
              ${Object.entries(DATA.evidenceLegend)
                .map(
                  ([key, value]) => `<button class="key-row ${key === state.keySymbol ? "active" : ""}" type="button" data-open-key="${esc(key)}">
                    <span class="key-icon"><span class="symbol-button inert">${symbolGlyph(key)}</span></span>
                    <div><p>${esc(value)}</p></div>
                  </button>`
                )
                .join("")}
              <div class="key-row"><span class="verify pending"></span><div><strong>Yellow dot</strong><p>Model-drafted or pending human/mod verification.</p></div></div>
              <div class="key-row"><span class="verify ok"></span><div><strong>Green dot</strong><p>A moderator has verified the article or claim set.</p></div></div>
            </div>`
      }
    </aside>
  </section>`;
}

function relatedPanel() {
  if (!state.tag) return "";
  const rows = relatedPeptides();
  const cacheKey = `${state.tag.type}:${state.tag.value}`;
  const wiki = wikiCache.get(cacheKey);
  const loading = wikiPending.has(cacheKey);
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
      <p>${
        wiki
          ? `${esc(wiki.extract)} ${wiki.url ? `<a class="table-link" href="${esc(wiki.url)}" target="_blank" rel="noreferrer">Wikipedia</a>` : ""}`
          : loading
            ? "Loading Wikipedia summary..."
            : "Summary pending fetch."
      }</p>
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
    <img src="/structures/${esc(p.id)}.png" alt="${esc(p.names.primary)} structure" loading="lazy" onerror="this.parentElement.remove()">
  </div>`;
}

function detail(p) {
  if (!p) return "";
  return `<section class="detail-backdrop" data-close-detail>
    <article class="detail" data-peptide-id="${esc(p.id)}" role="dialog" aria-modal="true" aria-label="${esc(p.names.primary)} detail">
      <div class="article-shell">
        <header class="article-head">
          <div>
            <p class="eyebrow">${esc(p.category)} / ${esc(moderationLabel(p.moderation.status))}</p>
            <h2 class="name-display">${formatPeptideName(p.names.primary)}</h2>
            <p>${esc(p.names.aliases.join(" / ") || p.classification.peptideClass)}</p>
          </div>
          <button class="icon" data-close aria-label="Close article">x</button>
        </header>
        <section class="article-section intro">
          <div>
            <p><span class="label-mono">MECHANISM:</span> ${esc(p.tile.mechanismSummary)}</p>
            <p><span class="label-mono">LOCALIZATION:</span> ${esc(p.tile.localization)}</p>
            <p><span class="label-mono">CLINICAL CONTEXT:</span> ${esc(p.tile.clinicalUses.join(" "))}</p>
          </div>
          <aside>
            ${structurePanel(p)}
            <span class="evidence-badge ${evidenceClass(p.classification.evidenceTier)}">${esc(DATA.evidenceTierLabel[p.classification.evidenceTier])}</span>
            <span class="status-pill">${esc(p.classification.regulatoryStatus.replaceAll("_", " "))}</span>
            <span class="status-pill">dosing: ${esc(p.tile.dosing.context.replaceAll("_", " "))}</span>
            <span class="status-pill">${esc(moderationLabel(p.moderation.status))}</span>
          </aside>
        </section>
        <section class="article-section">
          <h3>Chemical Identity</h3>
          <table>
            <tbody>
              <tr><th>Chemical names / aliases</th><td>${esc(p.names.aliases.join(" / ") || "No alternate chemical names imported.")}</td></tr>
              <tr><th>Trade names</th><td>${esc(p.names.tradeNames.join(" / ") || "No trade names imported.")}</td></tr>
              <tr><th>Formula</th><td>${esc(p.identity.formula || "Formula pending extraction.")}</td></tr>
              <tr><th>One-letter sequence</th><td>${esc(p.identity.sequenceOneLetter || "Sequence pending extraction.")}</td></tr>
              <tr><th>Three-letter sequence</th><td>${esc(p.identity.sequenceThreeLetter || "Sequence pending extraction.")}</td></tr>
            </tbody>
          </table>
        </section>
        ${signalingSection(p)}
        <section class="article-section">
          <h3>Clinical And Enhancement Use</h3>
          <table>
            <tbody>
              <tr><th>Medical / clinical use</th><td>${esc(p.tile.clinicalUses.join(" "))}</td></tr>
              <tr><th>Enhancement / common-use context</th><td>${esc(
                p.expanded.anecdotalUse.length ? p.expanded.anecdotalUse.join(" ") : "No enhancement/common-use statement imported."
              )}</td></tr>
              <tr><th>Dosing context</th><td>${esc(`${p.tile.dosing.quick} ${p.tile.dosing.adminRoute}`)}</td></tr>
              <tr><th>Safety</th><td>${esc(`${p.expanded.safetyDetail} ${p.tile.sideEffects.join(" ")}`)}</td></tr>
            </tbody>
          </table>
        </section>
        ${safetyPanel(p)}
        ${enhancementPanel(p)}
        <section class="article-section">
          <h3>Evidence And Article Notes</h3>
          <table>
            <tbody>
              <tr><th>Human evidence</th><td>${esc(p.expanded.humanEvidence)}</td></tr>
              <tr><th>Animal evidence</th><td>${esc(p.expanded.animalEvidence)}</td></tr>
              <tr><th>Mechanism detail</th><td>${esc(p.expanded.mechanismDetail)}</td></tr>
              <tr><th>Missing evidence</th><td>${esc(p.expanded.missingEvidence.join("; ") || "No missing-evidence list yet.")}</td></tr>
            </tbody>
          </table>
        </section>
        <section class="article-section">
          <h3>Interactable Biology</h3>
          <div class="tag-block"><h4>Effects</h4>${p.tile.enhancingEffects.map((effect) => tag("effect", effect.label, effect.symbols, p.id)).join("")}</div>
          <div class="tag-block"><h4>Genes</h4>${p.biology.genes.map((gene) => tag("gene", gene, [], p.id)).join("") || '<span class="muted">Pending extraction</span>'}</div>
          <div class="tag-block"><h4>Proteins</h4>${p.biology.proteins.map((protein) => tag("protein", protein, [], p.id)).join("") || '<span class="muted">Pending extraction</span>'}</div>
          <div class="tag-block"><h4>Channels</h4>${p.biology.channelsTransporters.map((channel) => tag("channel", channel, [], p.id)).join("") || '<span class="muted">Pending extraction</span>'}</div>
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
                        <td>${tag("cytokine", item.name, item.symbols, p.id)}</td>
                        <td>${esc(item.effect)}</td>
                        <td>${esc(item.context)}</td>
                        <td>${symbols(item.symbols)}</td>
                      </tr>`
                    )
                    .join("")
                : '<tr><td colspan="4">No sourced cytokine/interleukin entries yet.</td></tr>'
            }</tbody>
          </table>
        </section>
        ${evidenceTables(p)}
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
      <h1 class="brand-title">${BRAND}</h1>
    </div>
  </section>`;
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
  app.innerHTML = `${lineFeature()}${hero()}${toolbar(categories)}
    <section class="tiles">${peptides.map(tile).join("")}</section>
    ${detail(state.selected)}
    ${relatedPanel()}
    ${keyModal()}
    ${bibliographyDrawer()}`;
  restoreFocus(focus);
  if (state.selected) {
    const detailElement = app.querySelector(".detail");
    const scrollTop = pendingDetailScrollTop ?? liveDetailScroll;
    if (detailElement && typeof scrollTop === "number") detailElement.scrollTop = scrollTop;
  }
  pendingDetailScrollTop = null;
}

app.addEventListener("input", (event) => {
  if (event.target.matches("[data-search]")) {
    state.query = event.target.value;
    render();
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
  const bibliographyClose = target.closest("[data-close-bibliography-button]");
  const keyOpen = target.closest("[data-open-key]");
  const keyBackdrop = target.closest("[data-close-key-modal]");
  const keyClose = target.closest("[data-close-key-button]");
  const relatedBackdrop = target.closest("[data-close-related-modal]");
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
    render();
    return;
  }

  if (bibliographyClose || (bibliographyBackdrop && target === bibliographyBackdrop)) {
    state.bibliographyOpen = false;
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
    fetchWikiSummary(state.tag);
    render();
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
  resetToGridState();
  render();
});

window.addEventListener("pointermove", (event) => {
  document.documentElement.style.setProperty("--line-x", `${event.clientX}px`);
  document.documentElement.style.setProperty("--line-y", `${event.clientY}px`);
});

syncHistory("grid");
render();
