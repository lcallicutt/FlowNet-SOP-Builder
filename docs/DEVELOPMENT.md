# Development log — phase completion notes

The application was built in the phases specified in the product brief. Each
phase note records what was completed and how it was verified.

## Phase 1 — Setup, auth, schema, workspaces, upload

**Completed**
- Next.js 15 + TypeScript + Tailwind v4 project; shadcn/ui components written
  in-repo (the registry CLI was unavailable in the build environment).
- Full Drizzle schema (`src/db/schema.ts`): users, workspaces,
  workspace_members, subscriptions, usage_records, projects, uploaded_files,
  processing_jobs, transcripts, transcript_segments, sop_documents,
  document_sections, procedure_steps, checklist_items, quick_guides,
  training_guides, document_versions, approvals, comments, attachments,
  shared_links, audit_logs — all with workspace ownership, timestamps, and
  relations. SQL migration generated in `drizzle/`.
- Environment template `.env.example`.
- Clerk auth: middleware protection, sign-in/up pages, webhook user sync,
  pending-invite claiming; `requireUser` / `requireWorkspace` authorization
  chokepoints with role hierarchy (owner > admin > editor > viewer).
- Workspace CRUD + members + roles; dashboard with stats and usage meter.
- Direct-to-storage uploads with signed PUT URLs, drag-and-drop UI, full
  client + server validation (type, size, duration, plan limits), rate
  limiting, audit records.

**Verification**: `tsc --noEmit` clean; `next build` clean; isolation and
validation covered by the test suite (see Phase 6).

## Phase 2 — Background processing, transcription, transcript review

**Completed**
- Inngest client + typed events; `process-video` function: FFmpeg audio
  extraction (mono/16kHz mp3), true-duration plan enforcement, 10-minute
  chunking for large audio, OpenAI transcription per chunk with offset
  merging, ordered timestamped segments, usage recording, per-step
  processing_jobs rows with retry/error capture, user-safe failure messages.
- `retranscribe` function reusing the stored source file.
- Transcript review screen: video player with signed URL, clickable
  timestamps that seek the player, search with highlighting, per-segment
  editing with dirty tracking and save, regenerate-with-warning, and the
  "Generate SOP Package" confirmation flow.
- FFmpeg runs on the worker deployment (`worker/`): `process-video` fails
  loudly if FFmpeg is missing rather than pretending to work.

**Verification**: transcript creation/editing tests green; pipeline logic
compiles and is exercised through route tests (event dispatch asserted).
Note: end-to-end media processing requires FFmpeg + API keys and was
validated at the unit/contract level in this environment.

## Phase 3 — AI analysis and generation

**Completed**
- Seven separate AI services (`src/lib/ai/`): transcript cleanup, process
  extraction, SOP generation, checklist generation, quick-guide generation,
  training-guide generation, document revision — each with its own prompt and
  strict Zod schema; shared operations-analyst system instruction.
- `callStructured`: JSON-mode call → Zod validation → exactly one structured
  repair attempt → `AiValidationError` (nothing malformed is ever saved; the
  transcript is preserved; the project returns to `transcript_ready` with a
  retry message).
- Uncertainty labeling (six review flags) carried onto steps/sections;
  sensitive findings recorded as context-only notices, never values.
- `generate-documents` Inngest function orchestrating analysis → generation →
  transactional persistence (`persistSopPackage`) with per-workspace SOP
  numbering.

**Verification**: AI schema + repair tests (valid/invalid/repair/fenced JSON),
persistence tests including the malformed-package rejection path.

## Phase 4 — Editor, library, versions

**Completed**
- Block/section editor with tabs (SOP · Checklist · Quick Guide · Training
  Guide · Transcript): inline editing with debounced autosave through a
  single validated content-operations endpoint (add/edit/delete/reorder
  sections, steps, checklist items; quick/training guide form editors),
  review-flag chips with resolve, AI-assisted revision per section/step,
  screenshot attachments on steps, document status changes.
- Searchable SOP library with department/category/owner/status/tag filters,
  duplicate, review-date highlighting.
- Version history: snapshot creation with revision notes, restore (with
  auto-snapshot of current state first), basic compare, plan-gated.

**Verification**: content-operation and version tests green (including step
renumbering and restore semantics).

## Phase 5 — Exports, sharing, billing

**Completed**
- Export engine (`src/lib/exports/`): PDF (pdf-lib layout engine with navy
  header band, page footers, drawn checkboxes), DOCX (docx package with
  styled headings/tables), Markdown, plain text; selection of SOP only /
  checklist / quick guide / training guide / full package; workspace branding
  on Business plan; smoke-tested across all 20 format×selection combinations.
- Read-only share links (random tokens, enable/disable, optional expiry,
  optional required auth) and the public `/share/[token]` page.
- Stripe billing: checkout, portal, webhook-driven subscription sync,
  centralized plan config (`src/lib/plans.ts`) — no prices or limits
  hard-coded anywhere else; transcription-minute enforcement at upload and
  retranscribe time.

**Verification**: export authorization tests (plan gating + member checks +
real PDF/DOCX bytes), share-link tests, subscription-limit tests.

## Phase 6 — Approvals, admin, security hardening, tests

**Completed**
- Approval workflow: assign reviewer, request approval, approve/reject with
  required comments on rejection, publish gating on the Business plan; full
  decision audit trail.
- Internal admin dashboard (`/admin`, platform-admin flag on users): totals
  for users/subscriptions/videos/minutes, failure lists showing job metadata
  without customer content, storage usage, recent signups, usage by plan.
- Security: signature-verified webhooks, signed URLs everywhere, soft
  deletes with object cleanup, account deletion with sole-owner protection,
  audit logging, uniform error handler (no stack traces to clients), rate
  limits on expensive endpoints.
- Test suite: 43 integration/unit tests on PGlite (real Postgres semantics)
  covering the required areas.

**Verification**: `pnpm test` — 7 files, 43 tests passing; `pnpm exec next
build` — clean production build.

## Honest gaps / follow-ups

See "Known limitations" in the README: Loom import placeholder, in-memory
rate-limit store, automated frame extraction not yet surfaced in UI, no
speaker diarization, priority-processing fast lane not enforced in Inngest,
and Stripe subscription seat/feature proration edge cases untested against a
live Stripe account.
