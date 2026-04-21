import { peptideRecords } from "@/data/peptide-records";

export function GET() {
  return Response.json({
    schemaVersion: "peptide-atlas.v0.1",
    count: peptideRecords.length,
    peptides: peptideRecords
  });
}
