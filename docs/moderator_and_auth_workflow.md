# Peptocopeia Moderator/Auth Workflow Draft

Last updated: 2026-04-21

## Purpose

Peptocopeia should eventually work like a scientific wiki with structured citation review. A moderator can verify a citation, connect it to one or more peptide claims, write a short verification note, and leave that note visible to other moderators before the claim is marked verified.

## Roles

- Reader: can view public peptide records, citations, and public vendor data.
- Moderator: can submit citation verifications and propose claim edits.
- Senior moderator: can resolve conflicts, approve/reject verifications, and mark a claim verified.
- Admin: can manage users, roles, imports, and publishing.

## Existing Scaffold

The Prisma schema already contains:

- `User` with `role` and `status`
- Auth.js-compatible `Account`, `Session`, and `VerificationToken`
- `ModeratorProfile` with permission flags
- `CitationVerification` with status, verdict, score, write-up, limitations, checked values, reviewer, claim IDs, and citation ID
- `AuditLog` for review/edit traceability

Google Auth is scaffolded in `src/lib/auth.ts`; production activation needs real `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, and `DATABASE_URL`.

## Proposed Verification Flow

1. A source import creates `Citation` rows, `Claim` rows, and links between them.
2. Claims enter `needsModeratorReview = true`.
3. A moderator opens a citation and fills:
   - verdict: supports, partially supports, contradicts, irrelevant, or unclear
   - source-quality score
   - exact checked values
   - verification write-up
   - limitations and extrapolation warnings
4. The verification enters `SUBMITTED`.
5. A senior moderator either marks it `VERIFIED`, requests changes, rejects it, or marks it superseded.
6. A claim only gets a green verified state when enough verified citation support exists and conflicts are resolved.
7. All changes create audit-log rows.

## UI States

- Yellow dot: model-drafted or pending human/mod verification.
- Green dot: verified by moderator.
- Red/conflict state: supporting sources disagree or a moderator flagged overstatement.

## Build Sequence

1. Keep public static review app live while the database-backed app is built.
2. Provision Postgres on Fly or Supabase.
3. Run Prisma migrations.
4. Add Google OAuth credentials and allowed callback URLs.
5. Seed peptide/citation/claim data from the current TypeScript data bundle.
6. Build `/admin` screens for verification queue, citation detail, claim comparison, and audit trail.
7. Add importers for Consensus CSV/RIS and vendor-price JSON.
8. Enable the agent only after retrieval is pinned to verified/cited records.
