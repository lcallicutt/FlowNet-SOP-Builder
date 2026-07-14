# FlowNet SOP Builder — media worker image
#
# Runs the same Next.js app as production, but with ffmpeg/ffprobe installed
# so the Inngest media functions (audio extraction, chunking, frame capture)
# can execute. Deploy this container to Railway / Fly.io / Render / ECS and
# sync Inngest against ITS /api/inngest URL (see worker/README.md).

FROM node:22-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time env placeholders; real values are injected at runtime.
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm exec next build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./next.config.ts

EXPOSE 3000
CMD ["pnpm", "exec", "next", "start", "-p", "3000"]
