import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * FFmpeg-based media processing. These functions run on the worker service
 * (or any Node runtime with ffmpeg/ffprobe on PATH) — NOT on Vercel
 * serverless functions and NOT in the browser. See worker/README.md.
 */

function run(
  command: string,
  args: string[],
  timeoutMs = 30 * 60 * 1000,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else
        reject(
          new Error(`${command} exited with code ${code}: ${stderr.slice(-2000)}`),
        );
    });
  });
}

export async function withTempDir<T>(
  fn: (dir: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "flownet-media-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Duration of a media file in seconds, via ffprobe. */
export async function probeDurationSeconds(filePath: string): Promise<number> {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const duration = parseFloat(stdout.trim());
  if (!Number.isFinite(duration)) {
    throw new Error("Could not determine media duration.");
  }
  return duration;
}

/**
 * Extract mono 16 kHz MP3 audio from a video (or re-encode audio input).
 * Output format is chosen for transcription quality vs. upload size.
 */
export async function extractAudio(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  await run("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-b:a",
    "64k",
    "-f",
    "mp3",
    outputPath,
  ]);
}

export const AUDIO_CHUNK_SECONDS = 10 * 60;

/**
 * Split an audio file into fixed-length chunks (last chunk may be shorter).
 * Returns chunk file paths in order, with their start offsets.
 */
export async function splitAudio(
  inputPath: string,
  outDir: string,
  chunkSeconds = AUDIO_CHUNK_SECONDS,
): Promise<{ path: string; offsetSeconds: number }[]> {
  const pattern = path.join(outDir, "chunk-%04d.mp3");
  await run("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-f",
    "segment",
    "-segment_time",
    String(chunkSeconds),
    "-c",
    "copy",
    pattern,
  ]);
  const files = (await readdir(outDir))
    .filter((f) => f.startsWith("chunk-") && f.endsWith(".mp3"))
    .sort();
  return files.map((f, i) => ({
    path: path.join(outDir, f),
    offsetSeconds: i * chunkSeconds,
  }));
}

/**
 * Extract a single frame at the given timestamp as JPEG bytes. Used by the
 * (post-MVP) automated screenshot capture; every extracted frame must be
 * reviewed by the user before insertion into documentation.
 */
export async function extractFrame(
  inputPath: string,
  atSeconds: number,
): Promise<Buffer> {
  return withTempDir(async (dir) => {
    const out = path.join(dir, "frame.jpg");
    await run("ffmpeg", [
      "-y",
      "-ss",
      String(atSeconds),
      "-i",
      inputPath,
      "-frames:v",
      "1",
      "-q:v",
      "3",
      out,
    ]);
    return readFile(out);
  });
}

export async function bufferToTempFile(
  dir: string,
  fileName: string,
  data: Buffer | Uint8Array,
): Promise<string> {
  const filePath = path.join(dir, fileName);
  await writeFile(filePath, data);
  return filePath;
}

/** True when ffmpeg + ffprobe are available on this host. */
export async function ffmpegAvailable(): Promise<boolean> {
  try {
    await run("ffmpeg", ["-version"], 10_000);
    await run("ffprobe", ["-version"], 10_000);
    return true;
  } catch {
    return false;
  }
}
