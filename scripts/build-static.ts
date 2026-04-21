import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { peptideRecords, sourceRegistry } from "../src/data/peptide-records";
import { evidenceLegend, evidenceTierLabel } from "../src/lib/evidence";
import physchemRaw from "../data/sources/derived/pubchem_physchem.json";

const staticDir = "static";
const accessedAt = "2026-04-21";

type AnyRecord = Record<string, any>;

const physchemItems = (physchemRaw as AnyRecord).items ?? {};

const ghrp6PkCitation = {
  id: "pmid-23099431",
  sourceType: "pubmed",
  title: "Pharmacokinetic study of Growth Hormone-Releasing Peptide 6 (GHRP-6) in nine male healthy volunteers",
  authors: ["Gil N", "et al."],
  year: 2012,
  url: "https://pubmed.ncbi.nlm.nih.gov/23099431/",
  accessedAt,
  quality: "primary",
  supportsClaimIds: [],
  notes: "Healthy-volunteer LC-MS pharmacokinetic study reporting distribution and elimination half-lives for intravenous GHRP-6."
};

const halfLifeOverrides: Record<string, { value: string; citationIds: string[]; note?: string }> = {
  "ghrp-6": {
    value: "distribution 7.6 +/- 1.9 min; elimination 2.5 +/- 1.1 h",
    citationIds: [ghrp6PkCitation.id],
    note: "Healthy-volunteer PK after IV dosing."
  }
};

function uniqById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function uniqStrings(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function compactSentence(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function extractHalfLifeValue(peptide: AnyRecord) {
  const override = halfLifeOverrides[peptide.id];
  if (override) return override;

  const blob = [
    peptide.tile?.dosing?.quick,
    peptide.expanded?.humanEvidence,
    peptide.expanded?.animalEvidence,
    peptide.expanded?.mechanismDetail,
    peptide.expanded?.safetyDetail
  ]
    .filter(Boolean)
    .join(" ");

  const sentence =
    compactSentence(blob)
      .split(/(?<=[.?!])\s+/)
      .find((part) => /(half-life|half life|t1\/2)/i.test(part)) ?? "";

  if (!sentence || /half-life is short/i.test(sentence) || /very short half-life/i.test(sentence)) return null;

  const patterns: Array<[RegExp, (match: RegExpExecArray) => string]> = [
    [/estimated terminal half-life (?:was|of)?\s*([^.]+)/i, (m) => m[1]],
    [/elimination half-life (?:is|was)?\s*(?:approximately|about)?\s*([^.]+)/i, (m) => m[1]],
    [/plasma half-life (?:is|was)?\s*(?:approximately|about|of)?\s*([^.]+)/i, (m) => m[1]],
    [/half-life extends to\s*([^.]+)/i, (m) => m[1]],
    [/half-life[^.]*\(\s*~?([^)]+)\)/i, (m) => `~${m[1].replace(/^~/, "")}`],
    [/half-life[^.]*~\s*([^.);]+)/i, (m) => `~${m[1]}`],
    [/t1\/2\s*~\s*([^.);]+)/i, (m) => `~${m[1]}`],
    [/half-life[^.]*approximately\s*([^.);]+)/i, (m) => m[1]]
  ];

  for (const [pattern, formatter] of patterns) {
    const match = pattern.exec(sentence);
    if (match) {
      return {
        value: compactSentence(formatter(match).replace(/,\s*which.*$/i, "").replace(/\s+and supporting.*$/i, "")),
        citationIds: uniqStrings(
          peptide.claims
            .filter((claim: AnyRecord) => {
              const haystack = `${claim.field || ""} ${claim.value || ""}`.toLowerCase();
              return /mechanism|human|animal|pk|pd|clinical|safety/.test(haystack);
            })
            .flatMap((claim: AnyRecord) => claim.citationIds || [])
        ).slice(0, 3)
      };
    }
  }

  return null;
}

function administrationProperty(peptide: AnyRecord) {
  const route = compactSentence(peptide.tile?.dosing?.adminRoute || "");
  if (!route) {
    return {
      value: null,
      citationIds: [] as string[],
      note: "Administration route pending extraction."
    };
  }

  const citationIds = uniqStrings(
    peptide.claims
      .filter((claim: AnyRecord) => claim.route || ["fda_label", "clinical_trial", "observational", "regulatory"].includes(claim.context))
      .flatMap((claim: AnyRecord) => claim.citationIds || [])
  ).slice(0, 4);

  return {
    value: route,
    citationIds,
    note: peptide.tile?.dosing?.quick ? compactSentence(peptide.tile.dosing.quick) : null
  };
}

function formatNumber(value: unknown, digits = 2) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return Number(num.toFixed(digits)).toString();
}

function inferWaterSolubility(entry: AnyRecord) {
  const xlogp = entry?.pubchem?.xlogp;
  const tpsa = entry?.pubchem?.tpsa;
  const charge = entry?.pubchem?.charge;
  if (xlogp == null || tpsa == null) return null;
  if (xlogp <= 0 || tpsa >= 140 || charge) return "predicted high aqueous compatibility";
  if (xlogp <= 2 && tpsa >= 90) return "predicted moderate aqueous compatibility";
  return "predicted lower aqueous compatibility";
}

function pubchemCitationFor(peptide: AnyRecord, entry: AnyRecord) {
  return {
    id: `pubchem-physchem-${peptide.id}`,
    sourceType: "other",
    title: `PubChem compound summary for ${peptide.names?.primary || peptide.id}`,
    authors: ["PubChem"],
    year: 2026,
    url: entry?.pubchem?.sourceUrl || `https://pubchem.ncbi.nlm.nih.gov/compound/${entry?.pubchem?.cid || ""}`,
    accessedAt,
    quality: "secondary",
    supportsClaimIds: [],
    notes: "Used for XLogP, topological polar surface area, charge, and related physicochemical descriptors. GRAVY is computed locally from the imported one-letter sequence."
  };
}

function enrichPeptide(peptide: AnyRecord) {
  const entry = physchemItems[peptide.id];
  const extraCitations = peptide.id === "ghrp-6" ? [ghrp6PkCitation] : [];
  if (extraCitations.length) {
    peptide.citations = uniqById([...(peptide.citations || []), ...extraCitations]);
  }

  let pubchemCitationId: string | null = null;
  if (entry?.pubchem?.sourceUrl) {
    const citation = pubchemCitationFor(peptide, entry);
    peptide.citations = uniqById([...(peptide.citations || []), citation]);
    pubchemCitationId = citation.id;
  }

  const halfLife = extractHalfLifeValue(peptide);
  const administration = administrationProperty(peptide);
  const pubchemCitationIds = pubchemCitationId ? [pubchemCitationId] : [];

  const properties = {
    halfLife: halfLife
      ? {
          value: halfLife.value,
          citationIds: halfLife.citationIds,
          note: halfLife.note || null
        }
      : {
          value: null,
          citationIds: [] as string[],
          note: "Half-life not standardized in the current cited record."
        },
    administration,
    pKa: {
      value: null,
      citationIds: pubchemCitationIds,
      note: "Peptide pKa values are sequence- and environment-dependent and were not standardized in the current imported source set."
    },
    polarity: {
      value: entry?.pubchem?.tpsa != null ? `TPSA ${formatNumber(entry.pubchem.tpsa, 1)} A^2` : null,
      citationIds: pubchemCitationIds,
      note: entry?.pubchem?.tpsa != null ? "Topological polar surface area from PubChem." : "Polarity descriptor pending extraction."
    },
    hydrophobicity: {
      value: entry?.computed?.gravy != null ? `GRAVY ${formatNumber(entry.computed.gravy, 3)}` : null,
      citationIds: pubchemCitationIds,
      note: entry?.computed?.gravy != null ? "Kyte-Doolittle grand average of hydropathicity computed from the imported one-letter sequence." : "Sequence-based hydrophobicity pending a usable one-letter sequence."
    },
    lipophilicity: {
      value: entry?.pubchem?.xlogp != null ? `XLogP ${formatNumber(entry.pubchem.xlogp, 2)}` : null,
      citationIds: pubchemCitationIds,
      note: entry?.pubchem?.xlogp != null ? "Predicted lipophilicity descriptor from PubChem." : "Lipophilicity descriptor not available from the current PubChem entry."
    },
    waterSolubility: {
      value: inferWaterSolubility(entry),
      citationIds: pubchemCitationIds,
      note: entry?.pubchem ? "Qualitative inference from XLogP, topological polar surface area, and charge; not a directly measured solubility value." : "Water-compatibility estimate pending physicochemical import."
    }
  };

  peptide.identity = { ...(peptide.identity || {}), properties };
  return peptide;
}

mkdirSync(`${staticDir}/fonts`, { recursive: true });
copyFileSync(
  "public/fonts/PixelSpaceFreePersonalUseR-zrppw.ttf",
  `${staticDir}/fonts/PixelSpaceFreePersonalUseR-zrppw.ttf`
);
copyFileSync("public/fonts/audio-nugget.ttf", `${staticDir}/fonts/audio-nugget.ttf`);
copyFileSync("public/fonts/toxigenesis.rg-bold.otf", `${staticDir}/fonts/toxigenesis.rg-bold.otf`);
copyFileSync("public/fonts/golden-girdle.otf", `${staticDir}/fonts/golden-girdle.otf`);
copyFileSync("public/fonts/LowresPixel-Regular.otf", `${staticDir}/fonts/LowresPixel-Regular.otf`);
copyFileSync("public/favicon.png", `${staticDir}/favicon.png`);
if (existsSync("public/structures")) {
  cpSync("public/structures", `${staticDir}/structures`, { recursive: true });
}
copyFileSync("static-src/styles.css", `${staticDir}/styles.css`);
copyFileSync("static-src/app.js", `${staticDir}/app.js`);

const enrichedPeptides = clone(peptideRecords).map(enrichPeptide);

const data = {
  peptides: enrichedPeptides,
  sourceRegistry,
  evidenceLegend,
  evidenceTierLabel,
  generatedAt: new Date().toISOString()
};

writeFileSync(`${staticDir}/data.js`, `window.PEPTIDE_ATLAS_DATA = ${JSON.stringify(data)};\n`);

const appScript = readFileSync("static-src/app.js", "utf8");
const appVersion = Buffer.from(appScript).byteLength;

writeFileSync(
  `${staticDir}/index.html`,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>peptocopeia</title>
  <meta name="description" content="peptocopeia is a source-backed peptide reference with citation review, vendor metadata, and moderator verification workflows.">
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="apple-touch-icon" href="/favicon.png">
  <meta property="og:image" content="https://peptocopeia.com/favicon.png">
  <meta name="twitter:image" content="https://peptocopeia.com/favicon.png">
  <meta name="twitter:card" content="summary">
  <link rel="stylesheet" href="/styles.css?v=${appVersion}">
</head>
<body>
  <main id="app"></main>
  <script src="/data.js?v=${appVersion}"></script>
  <script src="/app.js?v=${appVersion}"></script>
</body>
</html>
`
);

console.log(`Built Peptocopeia static review build with ${peptideRecords.length} records.`);
