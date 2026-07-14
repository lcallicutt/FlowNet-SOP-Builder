/**
 * Loom URL importer — clearly separated service.
 *
 * STATUS: PLACEHOLDER (not yet a working importer).
 *
 * Loom does not offer a public, authorization-free download API. Whether a
 * share URL is downloadable depends on the video owner's sharing settings,
 * and Loom's terms restrict scraping. We therefore do NOT pretend a Loom URL
 * can always be downloaded. This module:
 *
 *   1. Validates and normalizes Loom share URLs (real, works today).
 *   2. Exposes `importFromLoom`, which currently returns a structured
 *      `not_supported` result telling the user to download the video from
 *      Loom and upload the file directly.
 *
 * When a sanctioned integration is added (Loom OAuth + the official API for
 * videos the user owns), implement `importFromLoom` to fetch the MP4 and
 * feed it into the same pipeline as direct uploads. The call sites and data
 * model (projects.sourceType = "loom_url", projects.loomUrl) already
 * support it.
 */

const LOOM_URL_PATTERN =
  /^https?:\/\/(?:www\.)?loom\.com\/(?:share|embed)\/([a-f0-9]{32})(?:\?.*)?$/i;

export function parseLoomUrl(
  url: string,
): { ok: true; videoId: string; normalizedUrl: string } | { ok: false; message: string } {
  const trimmed = url.trim();
  const match = trimmed.match(LOOM_URL_PATTERN);
  if (!match) {
    return {
      ok: false,
      message:
        "That doesn't look like a Loom share link. Expected a URL like https://www.loom.com/share/<video-id>.",
    };
  }
  return {
    ok: true,
    videoId: match[1].toLowerCase(),
    normalizedUrl: `https://www.loom.com/share/${match[1].toLowerCase()}`,
  };
}

export type LoomImportResult =
  | { status: "queued"; projectId: string }
  | { status: "not_supported"; message: string };

export async function importFromLoom(_params: {
  workspaceId: string;
  userId: string;
  loomUrl: string;
}): Promise<LoomImportResult> {
  return {
    status: "not_supported",
    message:
      "Automatic Loom importing isn't available yet — Loom videos can only be downloaded with the owner's authorization. Open the video in Loom, use its Download option, and upload the file here directly. We've saved the Loom link on the project for reference.",
  };
}
