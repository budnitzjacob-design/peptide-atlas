const DATA = window.PEPTIDE_ATLAS_DATA;
const BRAND = "peptocopeia";
const app = document.getElementById("app");

let state = {
  query: "",
  category: "All",
  sort: "evidence",
  selected: null,
  tag: null,
  agent: false
};

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
    .map((symbol) => `<abbr title="${esc(DATA.evidenceLegend[symbol] || "unmapped evidence symbol")}">${esc(symbol)}</abbr>`)
    .join("")}</span>`;
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

function citationLink(citation, index) {
  return `<span class="citation" tabindex="0">
    <a href="${esc(citation.url)}" target="_blank" rel="noreferrer">[${index + 1}]</a>
    <span class="citation-popover">
      <strong>${esc(citation.title)}</strong>
      <span>${esc((citation.authors || []).join(", "))} ${esc(citation.year ? `(${citation.year})` : "")}</span>
      <span>${esc(citation.notes)}</span>
      <span>Retrieved ${esc(citation.accessedAt || "date pending")}</span>
    </span>
  </span>`;
}

function tag(type, value, sy = []) {
  return `<button class="tag tag-${esc(type)}" data-tag-type="${esc(type)}" data-tag-value="${esc(value)}">
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
      return matchesQuery && matchesCategory;
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

function relatedPeptides() {
  if (!state.tag) return [];
  const target = norm(state.tag.value);
  return DATA.peptides
    .map((p) => {
      const matches = [];
      if (state.tag.type === "effect") {
        p.tile.enhancingEffects.forEach((effect) => {
          const item = norm(effect.label);
          if (item.includes(target) || target.includes(item)) matches.push(effect.label);
        });
      }
      if (state.tag.type === "gene" && p.biology.genes.some((gene) => norm(gene) === target)) matches.push(state.tag.value);
      if (state.tag.type === "protein" && p.biology.proteins.some((protein) => norm(protein) === target)) matches.push(state.tag.value);
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
  return `<article class="tile" data-expand="${esc(p.id)}" tabindex="0" aria-label="Open ${esc(p.names.primary)} article">
    <header>
      <div>
        <p class="eyebrow">${esc(p.category)}</p>
        <h2>${esc(p.names.primary)}</h2>
        <p class="aliases">${esc(p.names.aliases.join(" / ") || p.classification.peptideClass)}</p>
      </div>
      <span class="verify ${p.moderation.status === "verified" ? "ok" : "pending"}" title="${esc(review)}"></span>
    </header>
    <div class="tile-status">
      <span class="evidence-badge ${evidenceClass(p.classification.evidenceTier)}">${esc(DATA.evidenceTierLabel[p.classification.evidenceTier])}</span>
      <span>${esc(p.classification.regulatoryStatus.replaceAll("_", " "))}</span>
      <span>${esc(review)}</span>
    </div>
    <p class="mechanism">${esc(p.tile.mechanismSummary)} ${p.citations.slice(0, 2).map(citationLink).join("")}</p>
    <dl class="quick">
      <div><dt>Localization</dt><dd>${esc(p.tile.localization)}</dd></div>
      <div><dt>Medical / Clinical</dt><dd>${esc(clinical)}</dd></div>
      <div><dt>Enhancement / Common Use</dt><dd>${esc(enhancement)}</dd></div>
      <div><dt>Dosing Context</dt><dd>${esc(p.tile.dosing.quick)} <span>${esc(p.tile.dosing.adminRoute)}</span></dd></div>
      <div><dt>Cost</dt><dd>${esc(p.tile.cost.range || "not imported")} <span>${esc(p.tile.cost.size || "")}</span></dd></div>
    </dl>
    <section class="effects">${p.tile.enhancingEffects.slice(0, 4).map((effect) => tag("effect", effect.label, effect.symbols)).join("")}</section>
    <section class="chips">${p.biology.proteins.slice(0, 5).map((protein) => tag("protein", protein)).join("")}</section>
    <p class="click-hint">Click tile for full article, citations, signaling, studies, and vendor tables.</p>
  </article>`;
}

function signalingSection(p) {
  const chains = p.biology.cascades.length
    ? p.biology.cascades
    : [{ category: "mechanism", steps: [p.classification.peptideClass, p.classification.mechanismFamily, "clinical effect requires extraction"], symbols: ["?"] }];
  return `<section class="article-section">
    <h3>Protein Signaling + Arrow Mechanisms</h3>
    <div class="signal-grid">
      ${chains
        .map(
          (chain) => `<div>
            <p class="eyebrow">${esc(chain.category)} ${symbols(chain.symbols)}</p>
            <div class="signal-chain">
              ${chain.steps
                .map((step, index) => `${index ? '<span class="signal-arrow">-></span>' : ""}<span class="signal-node">${esc(step)}</span>`)
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
      const protocol = [claim.context.replaceAll("_", " "), claim.route].filter(Boolean).join("; ") || "Protocol pending extraction.";
      return `<tr>
        <td><a href="${esc(citation.url)}" target="_blank" rel="noreferrer">${esc(citation.title)}</a><br><span class="muted">Retrieved ${esc(citation.accessedAt || "date pending")}</span></td>
        <td>${esc(population)}</td>
        <td>${esc("n pending extraction")}</td>
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

function relatedPanel() {
  if (!state.tag) return "";
  const rows = relatedPeptides();
  return `<section class="related-panel">
    <header>
      <div>
        <p class="eyebrow">Related peptides</p>
        <h3>${esc(state.tag.value)}</h3>
      </div>
      <button class="icon" data-clear-related>x</button>
    </header>
    <table>
      <thead><tr><th>Peptide</th><th>Evidence</th><th>Critical summary</th><th>Shared item</th></tr></thead>
      <tbody>${
        rows.length
          ? rows
              .map(
                (item) => `<tr>
                  <td><button class="inline-link" data-expand="${esc(item.p.id)}">${esc(item.p.names.primary)}</button></td>
                  <td>${esc(DATA.evidenceTierLabel[item.p.classification.evidenceTier])}</td>
                  <td>${esc(item.p.tile.mechanismSummary)}</td>
                  <td>${esc(item.matches.join(", "))}</td>
                </tr>`
              )
              .join("")
          : '<tr><td colspan="4">No related peptide rows in the current data.</td></tr>'
      }</tbody>
    </table>
  </section>`;
}

function detail(p) {
  if (!p) return "";
  return `<section class="detail-backdrop" data-close-detail>
    <article class="detail" role="dialog" aria-modal="true" aria-label="${esc(p.names.primary)} detail">
      <div class="article-shell">
        <header class="article-head">
          <div>
            <p class="eyebrow">${esc(p.category)} / ${esc(moderationLabel(p.moderation.status))}</p>
            <h2>${esc(p.names.primary)}</h2>
            <p>${esc(p.names.aliases.join(" / ") || p.classification.peptideClass)}</p>
          </div>
          <button class="icon" data-close aria-label="Close article">x</button>
        </header>
        <section class="article-section intro">
          <div>
            <p><strong>Mechanism.</strong> ${esc(p.tile.mechanismSummary)}</p>
            <p><strong>Localization.</strong> ${esc(p.tile.localization)}</p>
            <p><strong>Clinical context.</strong> ${esc(p.tile.clinicalUses.join(" "))}</p>
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
          <div class="tag-block"><h4>Effects</h4>${p.tile.enhancingEffects.map((effect) => tag("effect", effect.label, effect.symbols)).join("")}</div>
          <div class="tag-block"><h4>Genes</h4>${p.biology.genes.map((gene) => tag("gene", gene)).join("") || '<span class="muted">Pending extraction</span>'}</div>
          <div class="tag-block"><h4>Proteins</h4>${p.biology.proteins.map((protein) => tag("protein", protein)).join("") || '<span class="muted">Pending extraction</span>'}</div>
          <div class="tag-block"><h4>Channels</h4>${p.biology.channelsTransporters.map((channel) => tag("channel", channel)).join("") || '<span class="muted">Pending extraction</span>'}</div>
        </section>
        ${relatedPanel()}
        <section class="article-section">
          <h3>Cytokines, Interleukins, And Markers</h3>
          <table>
            <thead><tr><th>Marker</th><th>Effect</th><th>Context</th><th>Basis</th></tr></thead>
            <tbody>${
              p.biology.cytokinesInterleukins.length
                ? p.biology.cytokinesInterleukins
                    .map(
                      (item) => `<tr>
                        <td>${tag("cytokine", item.name, item.symbols)}</td>
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
            <thead><tr><th>Vendor</th><th>Product</th><th>Cost</th><th>Lab / COA</th><th>Date</th></tr></thead>
            <tbody>${
              p.vendorData.length
                ? p.vendorData
                    .map(
                      (v) => `<tr>
                        <td>${esc(v.vendor)}</td>
                        <td>${esc(`${v.productName} ${v.vialSize || ""}`)}</td>
                        <td>${esc(v.priceRange || "not imported")}</td>
                        <td>${v.coaUrl ? `<a href="${esc(v.coaUrl)}" target="_blank" rel="noreferrer">COA / certification</a>` : esc(v.lab || "not imported")}</td>
                        <td>${esc(v.date || "date pending")}</td>
                      </tr>`
                    )
                    .join("")
                : '<tr><td colspan="5">No vendor rows imported.</td></tr>'
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
                (citation, index) => `<tr>
                  <td>${citationLink(citation, index)}</td>
                  <td><a href="${esc(citation.url)}" target="_blank" rel="noreferrer">${esc(citation.title)}</a></td>
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
  const humanCount = DATA.peptides.filter((p) => p.classification.evidenceTier.includes("human") || p.classification.evidenceTier.includes("fda")).length;
  const claimCount = DATA.peptides.reduce((sum, p) => sum + p.claims.length, 0);
  return `<section class="hero">
    <div>
      <p class="eyebrow">production scaffold / model-checkable data</p>
      <h1 class="brand-title">${BRAND}</h1>
      <p class="lede">Source-backed peptide reference for biologists and physicians, with public vendor context, contextual dosing labels, hover citations, moderator review, and future agent reasoning.</p>
      <div class="hero-actions"><button data-agent>atlas agent</button></div>
      <div class="review-key">
        <span><i class="review-dot"></i>Yellow dot means model-drafted or pending human/mod verification.</span>
        <span><i class="review-dot ok"></i>Green dot means a moderator has verified the article or claim set.</span>
      </div>
    </div>
    <aside class="legend">
      ${Object.entries(DATA.evidenceLegend).map(([key, value]) => `<span><abbr>${esc(key)}</abbr>${esc(value)}</span>`).join("")}
    </aside>
  </section>
  <section class="source-strip">
    <strong>${DATA.peptides.length}</strong><span>peptide records</span>
    <strong>${humanCount}</strong><span>human/regulatory records</span>
    <strong>${claimCount}</strong><span>claim objects</span>
    <strong>${DATA.sourceRegistry.length}</strong><span>source workflows</span>
  </section>`;
}

function pipeline() {
  return `<section class="pipeline">
    ${DATA.sourceRegistry
      .map(
        (source) => `<article>
          <p class="eyebrow">${esc(source.status.replaceAll("_", " "))}</p>
          <h2>${esc(source.name)}</h2>
          <p>${esc(source.use)}</p>
        </article>`
      )
      .join("")}
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
  </section>`;
}

function agentPanel() {
  if (!state.agent) return "";
  return `<aside class="agent-panel">
    <header>
      <div>
        <p class="eyebrow">Atlas agent / disabled</p>
        <h3>Reason Over Data</h3>
      </div>
      <button class="icon" data-agent>x</button>
    </header>
    <p>The future agent will answer only from peptide records, citations, source snapshots, Consensus exports, vendor snapshots, and moderator verifications. It is wired as a UI affordance now; backend retrieval is intentionally disabled in this review build.</p>
    <textarea placeholder="Future: compare mitochondrial peptides with human clinical evidence and safety limitations."></textarea>
    <button disabled>Backend retrieval not enabled yet</button>
  </aside>`;
}

function render() {
  const focus = captureFocus();
  const categories = ["All", ...new Set(DATA.peptides.map((p) => p.category))];
  const peptides = filteredPeptides();
  app.innerHTML = `${hero()}${pipeline()}${toolbar(categories)}
    <section class="tiles">${peptides.map(tile).join("")}</section>
    ${detail(state.selected)}
    ${agentPanel()}`;
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
  render();
});

app.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : event.target.parentElement;
  if (!target) return;
  const closeDetail = target.closest("[data-close]");
  const backdrop = target.closest("[data-close-detail]");
  const tagButton = target.closest("[data-tag-type]");
  const clearRelated = target.closest("[data-clear-related]");
  const agentButton = target.closest("[data-agent]");
  const expandTarget = target.closest("[data-expand]");
  const interactive = target.closest("button, a, input, select, textarea, .citation");

  if (closeDetail || (backdrop && target === backdrop)) {
    state.selected = null;
    state.tag = null;
    render();
    return;
  }

  if (tagButton) {
    state.tag = { type: tagButton.dataset.tagType, value: tagButton.dataset.tagValue };
    render();
    return;
  }

  if (clearRelated) {
    state.tag = null;
    render();
    return;
  }

  if (agentButton) {
    state.agent = !state.agent;
    render();
    return;
  }

  if (expandTarget && !interactive) {
    state.selected = DATA.peptides.find((p) => p.id === expandTarget.dataset.expand);
    state.tag = null;
    render();
  }
});

app.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const expandTarget = event.target.closest("[data-expand]");
    if (expandTarget) {
      state.selected = DATA.peptides.find((p) => p.id === expandTarget.dataset.expand);
      state.tag = null;
      render();
    }
  }
  if (event.key === "Escape" && state.selected) {
    state.selected = null;
    state.tag = null;
    render();
  }
});

document.addEventListener("pointermove", (event) => {
  document.documentElement.style.setProperty("--mx", `${Math.round((event.clientX / window.innerWidth) * 100)}%`);
  document.documentElement.style.setProperty("--my", `${Math.round((event.clientY / window.innerHeight) * 100)}%`);
});

render();
