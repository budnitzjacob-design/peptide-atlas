// Combined checks for the catalog and expanded-record copy revisions.
import fs from 'node:fs';import assert from 'node:assert/strict';
await import('./validate-expanded.mjs');
const catalog=JSON.parse(fs.readFileSync('generated/research-2026-10-19/copy-audit.json'));assert(catalog.reductionPercent>=80);console.log(JSON.stringify({catalogDescriptionReduction:catalog.reductionPercent}));
