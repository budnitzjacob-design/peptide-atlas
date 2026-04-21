export async function POST() {
  return Response.json(
    {
      enabled: false,
      reason: "Atlas Agent is staged but disabled until backend retrieval, source snapshots, and moderator verifications are connected.",
      guardrails: [
        "Answer only from Peptide Atlas records and citations.",
        "Cite every scientific claim.",
        "Do not provide personal medical advice or unsourced protocols.",
        "Separate human, animal, cell, vendor, and anecdotal evidence."
      ]
    },
    { status: 501 }
  );
}
