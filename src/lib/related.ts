import { peptideRecords } from "@/data/peptide-records";

function norm(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function relatedByTag(type: string, value: string) {
  const target = norm(value);
  return peptideRecords
    .map((peptide) => {
      const matches: string[] = [];
      if (type === "effect") {
        peptide.tile.enhancingEffects.forEach((effect) => {
          const item = norm(effect.label);
          if (item.includes(target) || target.includes(item)) matches.push(effect.label);
        });
      }
      if (type === "gene" && peptide.biology.genes.some((x) => norm(x) === target)) matches.push(value);
      if (type === "protein" && peptide.biology.proteins.some((x) => norm(x) === target)) matches.push(value);
      if (type === "receptor" && peptide.biology.receptors.some((x) => norm(x).includes(target) || target.includes(norm(x)))) matches.push(value);
      if (type === "cytokine" && peptide.biology.cytokinesInterleukins.some((x) => norm(x.name) === target)) matches.push(value);
      if (type === "channel" && peptide.biology.channelsTransporters.some((x) => norm(x).includes(target) || target.includes(norm(x)))) matches.push(value);
      return { peptide, matches };
    })
    .filter((row) => row.matches.length > 0);
}
