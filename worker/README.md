# Media worker service

Video processing (FFmpeg audio extraction, audio chunking, and future frame
capture) cannot run on Vercel serverless functions — they lack FFmpeg and have
tight execution limits. FlowNet SOP Builder therefore splits deployment into
two targets that run the **same codebase**:

| Deployment | Runs | FFmpeg | Serves |
|---|---|---|---|
| Vercel | Web app, API routes, light Inngest functions | no | user traffic |
| Worker (this Docker image) | Inngest media + generation functions | yes | `/api/inngest` only |

## How work is routed

All background work flows through [Inngest](https://www.inngest.com). API
routes only `inngest.send(...)` events — they never process media inline.
Inngest delivers function runs to whichever deployment is **synced** as the
app's serve endpoint:

1. Deploy this image (Railway, Fly.io, Render, ECS…) with the environment
   variables listed below.
2. In the Inngest dashboard, sync the app using the **worker's** URL:
   `https://<worker-host>/api/inngest`.
3. The `process-video` function refuses to run (fails with a clear error)
   when FFmpeg is missing, so an accidental sync against Vercel fails loudly
   instead of corrupting projects.

For local development you don't need any of this: run
`npx inngest-cli@latest dev` next to `pnpm dev` and install ffmpeg locally
(`brew install ffmpeg` / `apt install ffmpeg`).

## Required environment variables

The worker needs the same values as the web app (see `.env.example`):

- `DATABASE_URL` — same Neon database
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- `OPENAI_API_KEY` (+ optional model overrides)
- `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
- `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (required for the
  app to boot; the worker serves no user traffic)

## Build & run

```bash
docker build -f worker/Dockerfile -t flownet-worker .
docker run --env-file .env.local -p 3000:3000 flownet-worker
```

## Scaling notes

- Transcription chunks are processed sequentially per project; concurrency
  across projects is governed by Inngest.
- Long recordings: audio is chunked into 10-minute segments
  (`AUDIO_CHUNK_SECONDS` in `src/lib/media.ts`) to stay under the
  transcription API's upload limit.
- Priority processing for Business-plan workspaces is passed as event data
  (`priority: true`); to enforce it, split the Inngest function into two
  queues or use Inngest's priority option as a follow-up.
