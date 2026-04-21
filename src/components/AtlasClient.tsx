"use client";

import { useMemo, useState } from "react";
import type { PeptideRecord } from "@/types/peptide";
import { evidenceClass, evidenceLegend, evidenceTierLabel } from "@/lib/evidence";

interface Props {
  initialPeptides: PeptideRecord[];
  sourceRegistry: Array<{ id: string; name: string; status: string; use: string }>;
}

const categoryOrder = [
  "Metabolic",
  "Growth Factors",
  "Recovery & Repair",
  "Mitochondrial",
  "Cognitive Enhancement",
  "Immune Support",
  "Anti-Aging",
  "Sleep & Relaxation",
  "Melanocortin / Metabolic",
  "Reproductive / Metabolic"
];

function norm(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function SymbolBadges({ symbols }: { symbols: string[] }) {
  return (
    <span className="symbols">
      {symbols.map((symbol) => (
        <abbr key={symbol} title={evidenceLegend[symbol as keyof typeof evidenceLegend] ?? "unmapped"}>
          {symbol}
        </abbr>
      ))}
    </span>
  );
}

function CitationMarker({ citation, index }: { citation: PeptideRecord["citations"][number]; index: number }) {
  return (
    <span className="citation" tabIndex={0}>
      <a href={citation.url} target="_blank" rel="noreferrer">[{index + 1}]</a>
      <span className="citation-popover">
        <strong>{citation.title}</strong>
        <span>{citation.authors.join(", ")} {citation.year ? `(${citation.year})` : ""}</span>
        <span>{citation.notes}</span>
        <span>Retrieved {citation.accessedAt}</span>
      </span>
    </span>
  );
}

function searchable(peptide: PeptideRecord) {
  return [
    peptide.names.primary,
    ...peptide.names.aliases,
    peptide.category,
    peptide.classification.peptideClass,
    peptide.tile.mechanismSummary,
    peptide.tile.localization,
    peptide.tile.clinicalUses.join(" "),
    peptide.biology.genes.join(" "),
    peptide.biology.proteins.join(" "),
    peptide.biology.cytokinesInterleukins.map((x) => `${x.name} ${x.effect}`).join(" ")
  ].join(" ").toLowerCase();
}

export function AtlasClient({ initialPeptides, sourceRegistry }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("evidence");
  const [selected, setSelected] = useState<PeptideRecord | null>(null);
  const [tag, setTag] = useState<{ type: string; value: string } | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);

  const categories = useMemo(() => {
    const values = [...new Set(initialPeptides.map((p) => p.category))];
    return ["All", ...values.sort((a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b))];
  }, [initialPeptides]);

  const peptides = useMemo(() => {
    return initialPeptides
      .filter((peptide) => {
        const matchesQuery = !query || searchable(peptide).includes(query.toLowerCase());
        const matchesCategory = category === "All" || peptide.category === category;
        return matchesQuery && matchesCategory;
      })
      .sort((a, b) => {
        if (sort === "name") return a.names.primary.localeCompare(b.names.primary);
        if (sort === "category") return a.category.localeCompare(b.category) || a.names.primary.localeCompare(b.names.primary);
        if (sort === "review") return b.claims.filter((c) => c.needsModeratorReview).length - a.claims.filter((c) => c.needsModeratorReview).length;
        const ar = Object.keys(evidenceTierLabel).indexOf(a.classification.evidenceTier);
        const br = Object.keys(evidenceTierLabel).indexOf(b.classification.evidenceTier);
        return ar - br || a.names.primary.localeCompare(b.names.primary);
      });
  }, [initialPeptides, query, category, sort]);

  const related = useMemo(() => {
    if (!tag) return [];
    const target = norm(tag.value);
    return initialPeptides
      .map((peptide) => {
        const matches: string[] = [];
        if (tag.type === "effect") peptide.tile.enhancingEffects.forEach((x) => (norm(x.label).includes(target) || target.includes(norm(x.label))) && matches.push(x.label));
        if (tag.type === "gene" && peptide.biology.genes.some((x) => norm(x) === target)) matches.push(tag.value);
        if (tag.type === "protein" && peptide.biology.proteins.some((x) => norm(x) === target)) matches.push(tag.value);
        if (tag.type === "cytokine" && peptide.biology.cytokinesInterleukins.some((x) => norm(x.name) === target)) matches.push(tag.value);
        if (tag.type === "channel" && peptide.biology.channelsTransporters.some((x) => norm(x).includes(target))) matches.push(tag.value);
        return { peptide, matches };
      })
      .filter((row) => row.matches.length);
  }, [initialPeptides, tag]);

  function BiologyTag({ type, value, symbols = [] }: { type: string; value: string; symbols?: string[] }) {
    return (
      <button className={`tag tag-${type}`} type="button" onClick={() => setTag({ type, value })}>
        {value} {symbols.length > 0 && <SymbolBadges symbols={symbols} />}
      </button>
    );
  }

  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">production scaffold / model-checkable data</p>
          <h1 className="brand-title">peptocopeia</h1>
          <p className="lede">
            Source-backed peptide reference for biologists and physicians, with public vendor context, contextual dosing labels, hover citations, moderator review, and future agent reasoning.
          </p>
          <div className="hero-actions">
            <a href="/admin">Mod queue</a>
            <a href="/agent">Agent plan</a>
            <button type="button" onClick={() => setAgentOpen(true)}>atlas agent</button>
          </div>
        </div>
        <aside className="legend">
          {Object.entries(evidenceLegend).map(([key, label]) => (
            <span key={key}><abbr>{key}</abbr>{label}</span>
          ))}
        </aside>
      </section>

      <section className="source-strip">
        <strong>{initialPeptides.length}</strong><span>peptide records</span>
        <strong>{initialPeptides.filter((p) => p.classification.evidenceTier.includes("human") || p.classification.evidenceTier.includes("fda")).length}</strong><span>human/regulatory records</span>
        <strong>{initialPeptides.reduce((sum, p) => sum + p.claims.length, 0)}</strong><span>claim objects</span>
        <strong>{sourceRegistry.length}</strong><span>source workflows</span>
      </section>

      <section className="pipeline">
        {sourceRegistry.map((source) => (
          <article key={source.id}>
            <p className="eyebrow">{source.status.replaceAll("_", " ")}</p>
            <h2>{source.name}</h2>
            <p>{source.use}</p>
          </article>
        ))}
      </section>

      <section className="toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search names, genes, proteins, effects, cytokines" />
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="evidence">Evidence strength</option>
          <option value="name">Name A-Z</option>
          <option value="category">Category</option>
          <option value="review">Needs review</option>
        </select>
      </section>

      <section className="tiles">
        {peptides.map((peptide) => (
          <article
            className="tile"
            key={peptide.id}
            role="button"
            tabIndex={0}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("button,a,input,select,textarea,.citation")) return;
              setSelected(peptide);
              setTag(null);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              setSelected(peptide);
              setTag(null);
            }}
          >
            <header>
              <div>
                <p className="eyebrow">{peptide.category}</p>
                <h2>{peptide.names.primary}</h2>
                <p className="aliases">{peptide.names.aliases.join(" / ") || peptide.classification.peptideClass}</p>
              </div>
              <span className={`verify ${peptide.moderation.status === "verified" ? "ok" : "pending"}`} title={peptide.moderation.status} />
            </header>
            <div className="tile-status">
              <span className={`evidence-badge ${evidenceClass(peptide.classification.evidenceTier)}`}>{evidenceTierLabel[peptide.classification.evidenceTier]}</span>
              <span>{peptide.classification.regulatoryStatus.replaceAll("_", " ")}</span>
            </div>
            <p className="mechanism">
              {peptide.tile.mechanismSummary} {peptide.citations.slice(0, 2).map((citation, i) => <CitationMarker citation={citation} index={i} key={citation.id} />)}
            </p>
            <dl className="quick">
              <div><dt>Localization</dt><dd>{peptide.tile.localization}</dd></div>
              <div><dt>Clinical / Research Use</dt><dd>{peptide.tile.clinicalUses[0]}</dd></div>
              <div><dt>Dosing Context</dt><dd>{peptide.tile.dosing.quick}</dd></div>
              <div><dt>Cost</dt><dd>{peptide.tile.cost.range ?? "not imported"} <span>{peptide.tile.cost.size ?? ""}</span></dd></div>
            </dl>
            <section className="effects">
              {peptide.tile.enhancingEffects.slice(0, 4).map((effect) => <BiologyTag type="effect" value={effect.label} symbols={effect.symbols} key={effect.label} />)}
            </section>
            <section className="chips">
              {peptide.biology.proteins.slice(0, 5).map((protein) => <BiologyTag type="protein" value={protein} key={protein} />)}
            </section>
            <p className="click-hint">Click tile for full article, citations, signaling, studies, and vendor tables.</p>
          </article>
        ))}
      </section>

      {selected && (
        <dialog className="detail" open>
          <article className="article-shell">
            <header className="article-head">
              <div>
                <p className="eyebrow">{selected.category} / {selected.moderation.status.replaceAll("_", " ")}</p>
                <h2>{selected.names.primary}</h2>
                <p>{selected.names.aliases.join(" / ") || selected.classification.peptideClass}</p>
              </div>
              <button className="icon" type="button" onClick={() => { setSelected(null); setTag(null); }}>x</button>
            </header>

            <section className="article-section intro">
              <div>
                <p><strong>Mechanism.</strong> {selected.tile.mechanismSummary}</p>
                <p><strong>Localization.</strong> {selected.tile.localization}</p>
                <p><strong>Clinical context.</strong> {selected.tile.clinicalUses.join(" ")}</p>
              </div>
              <aside>
                <span className={`evidence-badge ${evidenceClass(selected.classification.evidenceTier)}`}>{evidenceTierLabel[selected.classification.evidenceTier]}</span>
                <span className="status-pill">{selected.classification.regulatoryStatus.replaceAll("_", " ")}</span>
                <span className="status-pill">dosing: {selected.tile.dosing.context.replaceAll("_", " ")}</span>
              </aside>
            </section>

            <section className="article-section">
              <h3>Evidence And Context</h3>
              <table>
                <tbody>
                  <tr><th>Human evidence</th><td>{selected.expanded.humanEvidence}</td></tr>
                  <tr><th>Animal evidence</th><td>{selected.expanded.animalEvidence}</td></tr>
                  <tr><th>Dosing context</th><td>{selected.tile.dosing.quick} {selected.tile.dosing.adminRoute}</td></tr>
                  <tr><th>Safety</th><td>{selected.expanded.safetyDetail} {selected.tile.sideEffects.join(" ")}</td></tr>
                  <tr><th>Anecdote/common use</th><td>{selected.expanded.anecdotalUse.length ? selected.expanded.anecdotalUse.join(" ") : "No anecdotal/common-use statement imported."}</td></tr>
                </tbody>
              </table>
            </section>

            <section className="article-section">
              <h3>Interactable Biology</h3>
              <div className="tag-block"><h4>Effects</h4>{selected.tile.enhancingEffects.map((x) => <BiologyTag type="effect" value={x.label} symbols={x.symbols} key={x.label} />)}</div>
              <div className="tag-block"><h4>Genes</h4>{selected.biology.genes.map((x) => <BiologyTag type="gene" value={x} key={x} />)}</div>
              <div className="tag-block"><h4>Proteins</h4>{selected.biology.proteins.map((x) => <BiologyTag type="protein" value={x} key={x} />)}</div>
              <div className="tag-block"><h4>Channels</h4>{selected.biology.channelsTransporters.map((x) => <BiologyTag type="channel" value={x} key={x} />)}</div>
            </section>

            {tag && (
              <section className="related-panel">
                <header>
                  <div><p className="eyebrow">Related peptides</p><h3>{tag.value}</h3></div>
                  <button className="icon" type="button" onClick={() => setTag(null)}>x</button>
                </header>
                <table>
                  <thead><tr><th>Peptide</th><th>Evidence</th><th>Critical summary</th><th>Shared item</th></tr></thead>
                  <tbody>
                    {related.map(({ peptide, matches }) => (
                      <tr key={peptide.id}>
                        <td><button className="inline-link" type="button" onClick={() => setSelected(peptide)}>{peptide.names.primary}</button></td>
                        <td>{evidenceTierLabel[peptide.classification.evidenceTier]}</td>
                        <td>{peptide.tile.mechanismSummary}</td>
                        <td>{matches.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            <section className="article-section">
              <h3>Cytokines, Interleukins, And Markers</h3>
              <table>
                <thead><tr><th>Marker</th><th>Effect</th><th>Context</th><th>Basis</th></tr></thead>
                <tbody>
                  {selected.biology.cytokinesInterleukins.length ? selected.biology.cytokinesInterleukins.map((entry) => (
                    <tr key={`${entry.name}-${entry.claimRef}`}>
                      <td><BiologyTag type="cytokine" value={entry.name} symbols={entry.symbols} /></td>
                      <td>{entry.effect}</td>
                      <td>{entry.context}</td>
                      <td><SymbolBadges symbols={entry.symbols} /></td>
                    </tr>
                  )) : <tr><td colSpan={4}>No sourced cytokine/interleukin entries yet.</td></tr>}
                </tbody>
              </table>
            </section>

            <section className="article-section">
              <h3>Manufacturers, Vendor Data, And Cost</h3>
              <table>
                <thead><tr><th>Vendor/Manufacturer</th><th>Product</th><th>Cost</th><th>COA</th></tr></thead>
                <tbody>
                  {selected.vendorData.length ? selected.vendorData.map((vendor) => (
                    <tr key={`${vendor.vendor}-${vendor.productName}`}>
                      <td>{vendor.vendor}</td>
                      <td>{vendor.productName} {vendor.vialSize}</td>
                      <td>{vendor.priceRange ?? "not imported"}</td>
                      <td>{vendor.coaUrl ? <a href={vendor.coaUrl} target="_blank" rel="noreferrer">certification page</a> : "not imported"}</td>
                    </tr>
                  )) : <tr><td colSpan={4}>No vendor rows imported.</td></tr>}
                </tbody>
              </table>
            </section>

            <section className="article-section citations-section">
              <h3>Citations</h3>
              <table>
                <thead><tr><th>Ref</th><th>Source</th><th>Type</th><th>Notes</th></tr></thead>
                <tbody>
                  {selected.citations.map((citation, index) => (
                    <tr key={citation.id}>
                      <td><CitationMarker citation={citation} index={index} /></td>
                      <td><a href={citation.url} target="_blank" rel="noreferrer">{citation.title}</a></td>
                      <td>{citation.quality}</td>
                      <td>{citation.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </article>
        </dialog>
      )}

      {agentOpen && (
        <aside className="agent-panel">
          <header>
            <div><p className="eyebrow">Atlas agent / disabled</p><h3>Reason Over Data</h3></div>
            <button className="icon" type="button" onClick={() => setAgentOpen(false)}>x</button>
          </header>
          <p>The future agent will answer only from peptide records, citations, source snapshots, Consensus exports, and moderator verifications.</p>
          <textarea placeholder="Future: compare mitochondrial peptides with human clinical evidence and safety limitations." />
          <button disabled>Backend retrieval not enabled yet</button>
        </aside>
      )}
    </main>
  );
}
