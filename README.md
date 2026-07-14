# FlowNet SOP Builder

Turn process videos into clear, repeatable SOPs. Upload a Loom video or screen
recording — FlowNet SOP Builder transcribes it, analyzes the demonstrated
process with AI, and produces an editable SOP, checklist, quick-reference
guide, and training documentation you can review, approve, export, and share.

## Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
- **Database**: Neon PostgreSQL via Drizzle ORM
- **Auth**: Clerk
- **Storage**: any S3-compatible service (Cloudflare R2 recommended) with signed URLs
- **Background jobs**: Inngest
- **Transcription & generation**: OpenAI (speech-to-text + structured JSON generation validated with Zod)
- **Media**: FFmpeg (worker service — see `worker/README.md`)
- **Payments**: Stripe
- **Tests**: Vitest + PGlite (real in-memory Postgres)

## Getting started

### 1. Prerequisites

- Node 20+ and pnpm (`corepack enable`)
- FFmpeg on your PATH for local media processing (`brew install ffmpeg` / `apt install ffmpeg`)
- Accounts: [Neon](https://neon.tech), [Clerk](https://clerk.com), [Cloudflare R2](https://developers.cloudflare.com/r2/) (or S3), [OpenAI](https://platform.openai.com), [Inngest](https://www.inngest.com), [Stripe](https://stripe.com)

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in every value — the file documents each one. Notes:

- **Clerk**: create an application, copy the publishable + secret keys, and add
  a webhook endpoint pointing at `/api/webhooks/clerk` (events: `user.created`,
  `user.updated`, `user.deleted`); copy its signing secret.
- **R2/S3**: create a bucket; keep it fully private (no public access). All
  reads/writes go through short-lived signed URLs. Set a CORS rule allowing
  `PUT` from your app origin so browser direct-uploads work.
- **Stripe**: create two recurring prices (Professional, Business) and put
  their price IDs in `STRIPE_PRICE_*`. Add a webhook endpoint at
  `/api/webhooks/stripe` (events: `checkout.session.completed`,
  `customer.subscription.*`).
- Plans, limits, and features live in **one place**: `src/lib/plans.ts`.

### 3. Create the schema

```bash
pnpm db:migrate   # applies ./drizzle/*.sql to DATABASE_URL
# or: pnpm db:push (dev-only schema sync)
```

### 4. Run

```bash
pnpm dev                      # web app on :3000
npx inngest-cli@latest dev    # local queue — auto-discovers /api/inngest
```

### 5. Demo data (optional)

```bash
pnpm seed -- --clerk-id=<your clerk user id>
```

Seeds a Business-plan workspace with four realistic SOPs (client onboarding,
weekly social scheduling, customer refunds, church event publishing),
including transcripts, review flags, checklists, and guides.

### 6. Tests

```bash
pnpm test
```

Integration tests run against a real in-memory Postgres (PGlite) with the
production Drizzle schema; Clerk, storage, and the queue are mocked at the
module boundary. Coverage includes workspace isolation, role enforcement,
file validation, transcript editing, AI schema validation + repair, SOP
persistence, content editing, version restore, the approval workflow, export
authorization, shared links, and subscription limits.

## Architecture

```
Browser ──► Next.js (Vercel) ──► Neon Postgres
   │            │  inngest.send(events)
   │            ▼
   │        Inngest ──► Worker (Docker + FFmpeg)  ──► OpenAI (whisper + generation)
   │                        │
   └── direct upload ──► S3/R2 (signed PUT/GET only)
```

- **Projects pipeline**: `uploaded → extracting_audio → transcribing →
  transcript_ready → (user reviews & confirms) → analyzing_process →
  generating_documentation → ready_for_review → published`, with `failed` as
  the error state carrying a user-safe message.
- **AI layer** (`src/lib/ai/`): separate services for transcript cleanup,
  process extraction, SOP generation, checklist generation, quick-guide
  generation, training-guide generation, and document revision. Every response
  is validated against strict Zod schemas; one structured repair attempt is
  made; nothing malformed is ever persisted (the transcript is always
  preserved and the user can retry).
- **Uncertainty handling**: the AI labels gaps instead of inventing detail —
  flags (`needs_confirmation`, `inferred_from_recording`,
  `missing_information`, `potential_security_concern`,
  `unclear_responsibility`, `unclear_completion_criteria`) surface in the
  editor until a human resolves them. Detected secrets are never written into
  documents; only their context is referenced.
- **Isolation & security**: every workspace-scoped query goes through
  `requireWorkspace()` (membership + role check); files are namespaced per
  workspace and only reachable via signed URLs; webhooks verify signatures;
  errors are logged server-side and mapped to friendly messages; audit records
  are written for important document actions.
- **Loom import**: an explicit placeholder (`src/lib/loom.ts`). Loom videos
  can't be reliably downloaded without the owner's authorization, so the UI
  says so honestly and stores the link on the project for a future sanctioned
  integration. Direct file upload is fully implemented.
- **Screenshots**: users can attach images to steps today; steps store their
  source-video timestamp so automated frame extraction (`extractFrame` in
  `src/lib/media.ts`) can be added later — with mandatory human review before
  insertion.

## Deployment

1. **Web app → Vercel.** Set all env vars from `.env.example`.
2. **Worker → any Docker host** (Railway/Fly/Render). Build with
   `worker/Dockerfile`; sync Inngest against the worker's `/api/inngest`.
   Details: `worker/README.md`.
3. **Webhooks**: point Clerk and Stripe webhooks at the Vercel deployment.

## Repository map

```
src/app/(marketing)     public site (home, pricing)
src/app/(app)           authenticated app (dashboard, upload, projects,
                        transcript review, editor, library, settings, admin)
src/app/share/[token]   public read-only shared documents
src/app/api             REST API (workspace-scoped, role-checked)
src/db/schema.ts        all 22 tables + enums + relations
src/lib/ai              AI services + schemas + structured-output validation
src/lib/exports         PDF / DOCX / Markdown / text renderers
src/inngest             background pipeline (process-video, generate-documents)
scripts/                demo-data seeder
tests/                  Vitest + PGlite integration suite
worker/                 FFmpeg worker image + deployment guide
```

## Known limitations (honest list)

- **Loom URL import** is a placeholder by design (see above).
- **Rate limiting** is in-memory per instance; swap the store in
  `src/lib/rate-limit.ts` for Upstash Redis in multi-instance production.
- **Automated screenshot extraction** is implemented at the FFmpeg level but
  not yet exposed in the UI (manual upload is).
- **Speaker labels**: the transcript model supports a `speaker` field; the
  default transcription model doesn't diarize, so it stays empty for now.
- **Priority processing** is passed through as event metadata; enforcing a
  separate fast lane in Inngest is a follow-up.
