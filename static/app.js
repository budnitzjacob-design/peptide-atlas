const DATA = window.PEPTIDE_ATLAS_DATA;
const BRAND = "peptocopeia";
const app = document.getElementById("app");

const defaultState = {
  query: "",
  category: "All",
  sort: "evidence",
  selected: null,
  tag: null,
  humanOnly: false,
  animalOnly: false,
  bibliographyOpen: false,
  legendOpen: true,
  brandAlt: false
};

let state = { ...defaultState };

const CATEGORY_COLORS = {
  Metabolic: "#7dd3fc",
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

const GLOBAL_CITATIONS = [];
const GLOBAL_CITATION_INDEX = new Map();
for (const peptide of DATA.peptides) {
  for (const citation of peptide.citations) {
    if (!GLOBAL_CITATION_INDEX.has(citation.id)) {
      GLOBAL_CITATION_INDEX.set(citation.id, GLOBAL_CITATIONS.length + 1);
      GLOBAL_CITATIONS.push(citation);
    }
  }
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
    .map((symbol) => `<abbr title="${esc(DATA.evidenceLegend[symbol] || "unmapped evidence symbol")}">${symbolGlyph(symbol)}</abbr>`)
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

function evidenceClass(tier) {
  if (tier.includes("fda") || tier.includes("phase3")) return "high";
  if (tier.includes("human")) return "human";
  if (tier === "conflict") return "conflict";
  return "early";
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
  return GLOBAL_CITATION_INDEX.get(citation.id) || "?";
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
  return `<button class="tag tag-${esc(type)}" data-tag-type="${esc(type)}" data-tag-value="${esc(value)}" data-tag-source="${esc(sourcePeptideId)}">
    ${esc(value)}${sy.length ? ` ${symbols(sy)}` : ""}
  </button>`;
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
      const matchesHuman = !state.humanOnly || hasHumanStudies(p);
      const matchesAnimal = !state.animalOnly || hasAnimalStudies(p);
      return matchesQuery && matchesCategory && matchesHuman && matchesAnimal;
    })
    .sort((a, b) => {
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
  state = { ...defaultState, legendOpen: state.legendOpen, brandAlt: state.brandAlt };
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
  return DATA.peptides
    .map((p) => {
      if (state.tag.sourcePeptideId && p.id === state.tag.sourcePeptideId) return { p, matches: [] };
      const matches = [];
      if (state.tag.type === "effect") {
        p.tile.enhancingEffects.forEach((effect) => {
          const item = norm(effect.label);
          if (item.includes(target) || target.includes(item)) matches.push(effect.label);
        });
        if (norm(p.tile.mechanismSummary).includes(target)) matches.push("mechanism overlap");
      }
      if (state.tag.type === "gene" && p.biology.genes.some((gene) => norm(gene) === target)) matches.push(state.tag.value);
      if (state.tag.type === "protein" && p.biology.proteins.some((protein) => norm(protein) === target)) matches.push(state.tag.value);
      if (state.tag.type === "protein" && p.biology.receptors.some((receptor) => norm(receptor).includes(target))) matches.push(`receptor-linked: ${state.tag.value}`);
      if (state.tag.type === "cytokine" && p.biology.cytokinesInterleukins.some((item) => norm(item.name) === target)) matches.push(state.tag.value);
      if (state.tag.type === "channel" && p.biology.channelsTransporters.some((channel) => norm(channel).includes(target))) {
        matches.push(state.tag.value);
      }
      return { p, matches };
    })
    .filter((item) => item.matches.length);
}

function tile(p) {
  const review = moderationLabel(p.moderation.status);
  const clinical = p.tile.clinicalUses[0] || "Clinical use context not yet verified.";
  const enhancement = p.expanded.anecdotalUse[0] || "No enhancement/common-use statement imported.";
  const risk = p.tile.sideEffects[0] || p.expanded.safetyDetail || "Key risk context pending extraction.";
  const classColor = categoryColor(p.category);
  return `<article class="tile" style="--type-color:${esc(classColor)}" data-expand="${esc(p.id)}" data-peptide-id="${esc(p.id)}" tabindex="0" aria-label="Open ${esc(p.names.primary)} article">
    <header>
      <div>
        <p class="eyebrow category-label">${esc(p.category)}</p>
        <h2 class="name-display">${formatPeptideName(p.names.primary)}</h2>
        <p class="aliases"><span class="type-pill">${esc(p.classification.peptideClass)}</span> ${esc(p.names.aliases.join(" / "))}</p>
      </div>
      <span class="verify ${p.moderation.status === "verified" ? "ok" : "pending"}" title="${esc(review)}"></span>
    </header>
    <div class="tile-status">
      <span class="evidence-badge ${evidenceClass(p.classification.evidenceTier)}" title="${esc(evidenceTierTitle(p.classification.evidenceTier))}">${esc(DATA.evidenceTierLabel[p.classification.evidenceTier])}</span>
      <span title="${esc(regulatoryLabel(p.classification.regulatoryStatus))}">${esc(p.classification.regulatoryStatus.replaceAll("_", " "))}</span>
      <span title="${esc(review)}">${esc(review)}</span>
    </div>
    <p class="mechanism">${esc(p.tile.mechanismSummary)} ${p.citations.slice(0, 2).map(citationLink).join("")}</p>
    <dl class="quick">
      <div><dt>Medical / Clinical</dt><dd>${esc(clinical)}</dd></div>
      <div><dt>Enhancement / Common Use</dt><dd>${esc(enhancement)}</dd></div>
      <div><dt>Key Risks</dt><dd>${esc(risk)}</dd></div>
    </dl>
    <section class="effects">${p.tile.enhancingEffects.slice(0, 4).map((effect) => tag("effect", effect.label, effect.symbols, p.id)).join("")}</section>
    <section class="chips">${p.biology.proteins.slice(0, 5).map((protein) => tag("protein", protein, [], p.id)).join("")}</section>
    <p class="click-hint">Click tile for full article, citations, signaling, studies, and vendor tables.</p>
  </article>`;
}

function signalingSection(p) {
  const chains = p.biology.cascades.length
    ? p.biology.cascades
    : [{ category: "mechanism", steps: [p.classification.peptideClass, p.classification.mechanismFamily, "clinical effect requires extraction"], symbols: ["?"] }];
  return `<section class="article-section">
    <h3>Physiological Pathways</h3>
    <p class="section-note">${esc(p.expanded.mechanismDetail)}</p>
    <div class="signal-grid">
      ${chains
        .map(
          (chain) => `<div>
            <p class="eyebrow">${esc(chain.category)} ${symbols(chain.symbols)}</p>
            <div class="signal-chain">
              ${chain.steps
                .map(
                  (step, index) =>
                    `${index ? '<span class="signal-arrow">-></span>' : ""}<span class="signal-node"><i class="signal-step-index">${index + 1}</i><span>${esc(step)}</span></span>`
                )
                .join("")}
            </div>
          </div>`
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
        <tbody>${GLOBAL_CITATIONS.map(
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

function relatedPanel(mode = "detail") {
  if (!state.tag) return "";
  const rows = relatedPeptides();
  return `<section class="related-panel ${mode === "global" ? "global-related" : ""}">
    <header>
      <div>
        <p class="eyebrow">Related peptides</p>
        <h3>${esc(state.tag.value)}</h3>
      </div>
      <button class="icon" data-clear-related>x</button>
    </header>
    <table>
      <thead><tr><th>Peptide</th><th>Evidence</th><th>Brief mechanism</th><th>Key effects</th><th>Shared item</th></tr></thead>
      <tbody>${
        rows.length
          ? rows
              .map(
                (item) => `<tr>
                  <td><button class="inline-link" data-expand="${esc(item.p.id)}">${esc(item.p.names.primary)}</button></td>
                  <td>${esc(DATA.evidenceTierLabel[item.p.classification.evidenceTier])}</td>
                  <td>${esc(item.p.tile.mechanismSummary)}</td>
                  <td>${esc(item.p.tile.enhancingEffects.slice(0, 3).map((effect) => effect.label).join(", ") || "none listed")}</td>
                  <td>${esc(item.matches.join(", "))}</td>
                </tr>`
              )
              .join("")
          : '<tr><td colspan="5">No related peptide rows in the current data.</td></tr>'
      }</tbody>
    </table>
  </section>`;
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
            <p><strong>Mechanism:</strong> ${esc(p.tile.mechanismSummary)}</p>
            <p><strong>Localization:</strong> ${esc(p.tile.localization)}</p>
            <p><strong>Clinical context:</strong> ${esc(p.tile.clinicalUses.join(" "))}</p>
          </div>
          <aside>
            <span class="evidence-badge ${evidenceClass(p.classification.evidenceTier)}">${esc(DATA.evidenceTierLabel[p.classification.evidenceTier])}</span>
            <span class="status-pill">${esc(p.classification.regulatoryStatus.replaceAll("_", " "))}</span>
            <span class="status-pill">dosing: ${esc(p.tile.dosing.context.replaceAll("_", " "))}</span>
            <span class="status-pill">${esc(moderationLabel(p.moderation.status))}</span>
          </aside>
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
        ${relatedPanel("detail")}
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
      <h1 class="brand-title ${state.brandAlt ? "alt" : ""}" data-toggle-brand>${BRAND}</h1>
      <p class="lede">peptide signaling & mechanism reference for biologists & physicians</p>
    </div>
    <aside class="legend ${state.legendOpen ? "open" : "collapsed"}">
      <button class="legend-toggle" data-toggle-legend aria-label="${state.legendOpen ? "Collapse key" : "Expand key"}">${state.legendOpen ? "-" : "+"}</button>
      ${state.legendOpen ? `<div class="legend-body">
        ${Object.entries(DATA.evidenceLegend).map(([key, value]) => `<span><abbr>${symbolGlyph(key)}</abbr>${esc(value)}</span>`).join("")}
        <span><i class="review-dot"></i>Yellow dot means model-drafted or pending human/mod verification.</span>
        <span><i class="review-dot ok"></i>Green dot means a moderator has verified the article or claim set.</span>
      </div>` : ""}
    </aside>
  </section>`;
}

function toolbar(categories) {
  return `<section class="toolbar">
    <input data-search data-focus-key="search" value="${esc(state.query)}" placeholder="Search names, genes, proteins, effects, cytokines">
    <select data-category data-focus-key="category">
      ${categories.map((category) => `<option ${category === state.category ? "selected" : ""}>${esc(category)}</option>`).join("")}
    </select>
    <select data-sort data-focus-key="sort">
      <option value="evidence" ${state.sort === "evidence" ? "selected" : ""}>Evidence strength</option>
      <option value="name" ${state.sort === "name" ? "selected" : ""}>Name A-Z</option>
      <option value="category" ${state.sort === "category" ? "selected" : ""}>Category</option>
      <option value="review" ${state.sort === "review" ? "selected" : ""}>Needs review</option>
    </select>
    <label class="toggle">
      <input type="checkbox" data-human-filter ${state.humanOnly ? "checked" : ""}>
      <span>Human studies</span>
    </label>
    <label class="toggle">
      <input type="checkbox" data-animal-filter ${state.animalOnly ? "checked" : ""}>
      <span>Animal studies</span>
    </label>
    <button class="bibliography-button" data-open-bibliography aria-label="Open bibliography">[n]</button>
  </section>`;
}

function render() {
  const focus = captureFocus();
  const categories = ["All", ...new Set(DATA.peptides.map((p) => p.category))];
  const peptides = filteredPeptides();
  app.innerHTML = `${hero()}${toolbar(categories)}
    ${state.tag && !state.selected ? relatedPanel("global") : ""}
    <section class="tiles">${peptides.map(tile).join("")}</section>
    ${detail(state.selected)}
    ${bibliographyDrawer()}`;
  restoreFocus(focus);
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
  if (event.target.matches("[data-human-filter]")) state.humanOnly = event.target.checked;
  if (event.target.matches("[data-animal-filter]")) state.animalOnly = event.target.checked;
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
  const bibliographyClose = target.closest("[data-close-bibliography-button]");
  const legendToggle = target.closest("[data-toggle-legend]");
  const brandToggle = target.closest("[data-toggle-brand]");
  const interactive = target.closest("button, a, input, select, textarea, .citation");

  if (closeDetail || (backdrop && target === backdrop)) {
    closeToGrid();
    return;
  }

  if (legendToggle) {
    state.legendOpen = !state.legendOpen;
    render();
    return;
  }

  if (brandToggle) {
    state.brandAlt = !state.brandAlt;
    render();
    return;
  }

  if (bibliographyButton) {
    state.bibliographyOpen = true;
    render();
    return;
  }

  if (bibliographyClose || (bibliographyBackdrop && target === bibliographyBackdrop)) {
    state.bibliographyOpen = false;
    render();
    return;
  }

  if (tagButton) {
    state.tag = { type: tagButton.dataset.tagType, value: tagButton.dataset.tagValue, sourcePeptideId: tagButton.dataset.tagSource || null };
    render();
    return;
  }

  if (clearRelated) {
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

document.addEventListener("pointermove", (event) => {
  document.documentElement.style.setProperty("--mx", `${Math.round((event.clientX / window.innerWidth) * 100)}%`);
  document.documentElement.style.setProperty("--my", `${Math.round((event.clientY / window.innerHeight) * 100)}%`);
});

window.addEventListener("popstate", () => {
  resetToGridState();
  render();
});

syncHistory("grid");
render();
