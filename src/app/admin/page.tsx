import Link from "next/link";
import { peptideRecords } from "@/data/peptide-records";

export default function AdminPage() {
  const needsReview = peptideRecords.flatMap((peptide) =>
    peptide.claims
      .filter((claim) => claim.needsModeratorReview)
      .map((claim) => ({ peptide, claim }))
  );

  return (
    <main className="admin-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Moderator route scaffold / Google Auth ready</p>
          <h1>Verification Queue</h1>
          <p className="lede">
            Claims enter here when model-drafted or high-risk. A moderator will review each source, write a rationale, and publish only after citation support is clear.
          </p>
        </div>
        <Link href="/">Atlas grid</Link>
      </header>

      <section className="review-dashboard">
        <article>
          <strong>{peptideRecords.length}</strong>
          <span>peptide records</span>
        </article>
        <article>
          <strong>{needsReview.length}</strong>
          <span>claims needing review</span>
        </article>
        <article>
          <strong>0</strong>
          <span>verified by human mods</span>
        </article>
      </section>

      <section className="review-list">
        {needsReview.slice(0, 80).map(({ peptide, claim }) => (
          <article key={claim.id} className="review-item">
            <p className="eyebrow">{peptide.names.primary} / {claim.context}</p>
            <h2>{claim.field}</h2>
            <p>{claim.value}</p>
            <dl>
              <div><dt>Species</dt><dd>{claim.species}</dd></div>
              <div><dt>Confidence</dt><dd>{Math.round(claim.confidence * 100)}%</dd></div>
              <div><dt>Citations</dt><dd>{claim.citationIds.join(", ")}</dd></div>
            </dl>
          </article>
        ))}
      </section>
    </main>
  );
}
