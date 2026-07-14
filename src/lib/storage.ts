import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * S3-compatible object storage (Cloudflare R2, AWS S3, MinIO, ...).
 * All access goes through short-lived signed URLs — objects are never public
 * and raw keys are never exposed to the client.
 */

let _client: S3Client | null = null;

export function s3Client(): S3Client {
  if (_client) return _client;
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("S3 storage is not configured (S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY).");
  }
  _client = new S3Client({
    region: process.env.S3_REGION ?? "auto",
    ...(endpoint ? { endpoint } : {}),
    credentials: { accessKeyId, secretAccessKey },
    // R2 and MinIO require path-style when using custom endpoints.
    forcePathStyle: Boolean(endpoint),
  });
  return _client;
}

export function bucket(): string {
  const b = process.env.S3_BUCKET;
  if (!b) throw new Error("S3_BUCKET is not configured.");
  return b;
}

/** Storage keys are namespaced by workspace for isolation and lifecycle rules. */
export function buildStorageKey(params: {
  workspaceId: string;
  projectId?: string;
  kind: string;
  fileName: string;
}): string {
  const safeName = params.fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-120);
  const scope = params.projectId
    ? `projects/${params.projectId}`
    : "workspace";
  return `workspaces/${params.workspaceId}/${scope}/${params.kind}/${crypto.randomUUID()}-${safeName}`;
}

const UPLOAD_URL_TTL_SECONDS = 60 * 15;
const DOWNLOAD_URL_TTL_SECONDS = 60 * 60;

export async function createSignedUploadUrl(params: {
  storageKey: string;
  contentType: string;
  contentLength?: number;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: params.storageKey,
    ContentType: params.contentType,
    ...(params.contentLength ? { ContentLength: params.contentLength } : {}),
  });
  return getSignedUrl(s3Client(), command, {
    expiresIn: UPLOAD_URL_TTL_SECONDS,
  });
}

export async function createSignedDownloadUrl(
  storageKey: string,
  opts?: { fileName?: string; expiresIn?: number },
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: storageKey,
    ...(opts?.fileName
      ? {
          ResponseContentDisposition: `attachment; filename="${opts.fileName.replace(/"/g, "")}"`,
        }
      : {}),
  });
  return getSignedUrl(s3Client(), command, {
    expiresIn: opts?.expiresIn ?? DOWNLOAD_URL_TTL_SECONDS,
  });
}

export async function deleteObject(storageKey: string): Promise<void> {
  await s3Client().send(
    new DeleteObjectCommand({ Bucket: bucket(), Key: storageKey }),
  );
}

export async function putObject(params: {
  storageKey: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<void> {
  await s3Client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: params.storageKey,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );
}
