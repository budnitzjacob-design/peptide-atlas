import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";

const input = process.argv[2];
if (!input) {
  console.error("Usage: npm run import:consensus -- path/to/consensus.csv");
  process.exit(1);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted && ch === '"' && next === '"') {
      cell += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (!quoted && ch === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const headers = rows.shift()?.map((h) => h.replace(/^\uFEFF/, "")) ?? [];
  return rows.map((values) => Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""])));
}

const rows = parseCsv(readFileSync(input, "utf8"));
const normalized = rows.map((row, index) => ({
  id: `consensus-${basename(input).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${index + 1}`,
  sourceType: "consensus",
  title: row.Title,
  takeaway: row.Takeaway,
  authors: String(row.Authors || "").split(",").map((x) => x.trim()).filter(Boolean),
  year: Number(row.Year) || null,
  citationCount: Number(row.Citations) || 0,
  abstract: row.Abstract,
  studyType: row["Study Type"],
  journal: row.Journal,
  journalSjrQuartile: row["Journal SJR Quartile"],
  doi: row.DOI || null,
  url: row["Consensus Link"],
  quality: row["Study Type"] === "rct" ? "primary" : "secondary",
  needsPrimaryLookup: true
}));

const out = input.replace(/\.csv$/i, ".normalized.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(normalized, null, 2));
console.log(`Imported ${normalized.length} Consensus rows -> ${out}`);
