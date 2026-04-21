import { AtlasClient } from "@/components/AtlasClient";
import { peptideRecords, sourceRegistry } from "@/data/peptide-records";

export default function Page() {
  return <AtlasClient initialPeptides={peptideRecords} sourceRegistry={sourceRegistry} />;
}
