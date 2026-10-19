# Peptocopeia production source

This folder contains the current peptocopeia.com static source with catalog and expanded-record copy edits. The repository root is an older implementation; its build does not generate this folder.

## Run and verify

From this folder:

    npm ci
    npm test
    npm run serve

The static site requires no JavaScript build or runtime dependencies. Acorn is used only to verify that interface logic and markup structure were preserved.

Catalog descriptions: 3,340 → 513 words (84.6% reduction).
Expanded narrative prose: 19,853 → 3,579 words (82.0% reduction).
Full expanded text including unchanged tables, labels and references: 172,012 → 133,328 words (22.5% reduction).

All 246 current structured study claims, 149 risk entries, and 310 citations are unchanged. HTML/CSS and all structure assets remain unchanged; app.js changes only explanatory pathway strings, with parsed runtime logic and markup preserved.

## Deployment

The included Dockerfile serves this folder with Python on port 3000. Do not run the repository root's legacy build to deploy these files.

The copied fly.toml names peptide-atlas-sandbox. Confirm that it is the app serving peptocopeia.com, then deploy from this folder using the owning Fly.io account:

    flyctl deploy --config fly.toml

The currently signed-in account cannot access that app, so no production deployment has been performed. The existing live site's audience/domain has not been changed.

Audits are in generated/research-2026-10-19/. Original deployed source is retained in baseline/; revisions/expanded-before/ is the comparison input for the expanded-record checks.
