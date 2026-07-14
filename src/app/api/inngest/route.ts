import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { processVideo, retranscribe } from "@/inngest/functions/process-video";
import { generateDocuments } from "@/inngest/functions/generate-documents";

/**
 * Inngest serve endpoint.
 *
 * Deployment note: media functions (process-video / retranscribe) need
 * ffmpeg, so in production this endpoint should be synced from the WORKER
 * deployment (Docker image with ffmpeg — see worker/), not from Vercel.
 * generate-documents is pure API work and can run anywhere. In local dev
 * (`npx inngest-cli dev`) everything runs in one place.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processVideo, retranscribe, generateDocuments],
});
