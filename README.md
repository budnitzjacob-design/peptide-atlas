# Peptocopeia

Source-verifiable peptide reference with public vendor context, contextual dosing labels, hover citations, and moderator-ready claim review.

## Current Deployment Target

The first production target is a static-first app served by a tiny Node server on Fly.io. This is intentionally fast and cache-friendly for thousands of readers.

## Architecture Track

The repo also includes the scalable backend track:

- Postgres schema in `prisma/schema.prisma`
- Auth.js/Google Auth scaffold in `src/lib/auth.ts`
- Moderator queue schema for citation verification
- Consensus CSV/RIS importer in `scripts/import-consensus.ts`
- Typed peptide schema in `src/types/peptide.ts`

## Data Quality Rules

- Human, animal, cell, review, vendor, and anecdotal/common-use evidence are labeled separately.
- Dosing is displayed only as context: FDA-label, clinical-trial, or anecdotal/common-use context.
- Vendor data is public for now but never used as efficacy/safety evidence.
- High-risk fields are marked for moderator review.
