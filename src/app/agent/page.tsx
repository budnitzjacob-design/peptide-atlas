import Link from "next/link";

export default function AgentPage() {
  return (
    <main className="admin-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Atlas agent / retrieval planned</p>
          <h1>Reasoning Layer</h1>
          <p className="lede">
            The agent endpoint is intentionally disabled until source snapshots, citation IDs, and moderator verifications are wired into retrieval.
            When enabled, it should answer only from Peptide Atlas data and cite every claim back to records.
          </p>
        </div>
        <Link href="/">Atlas grid</Link>
      </header>
      <section className="article-section">
        <h2>Agent Guardrails</h2>
        <table>
          <tbody>
            <tr><th>Allowed context</th><td>Peptide records, citations, source snapshots, Consensus exports, FDA/PubMed imports, moderator writeups.</td></tr>
            <tr><th>Refusal rule</th><td>No personal medical advice, no unsourced protocols, no vendor recommendation.</td></tr>
            <tr><th>Answer format</th><td>Concise answer, evidence table, citation list, confidence/limitations, human vs animal distinction.</td></tr>
          </tbody>
        </table>
      </section>
    </main>
  );
}
