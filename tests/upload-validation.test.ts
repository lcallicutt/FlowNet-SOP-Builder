import { describe, expect, it } from "vitest";
import {
  isSupportedFile,
  validateUpload,
} from "@/lib/upload-validation";

describe("file validation", () => {
  it("accepts all supported formats", () => {
    for (const [name, type] of [
      ["demo.mp4", "video/mp4"],
      ["demo.mov", "video/quicktime"],
      ["demo.webm", "video/webm"],
      ["demo.m4v", "video/x-m4v"],
      ["demo.mp3", "audio/mpeg"],
      ["demo.wav", "audio/wav"],
      ["demo.m4a", "audio/mp4"],
    ]) {
      expect(isSupportedFile(name, type), `${name} ${type}`).toBe(true);
    }
  });

  it("rejects unsupported types", () => {
    expect(isSupportedFile("malware.exe", "application/x-msdownload")).toBe(false);
    expect(isSupportedFile("doc.pdf", "application/pdf")).toBe(false);
    // Extension spoofing with a wrong declared type still fails.
    expect(isSupportedFile("video.mp4.exe", "application/octet-stream")).toBe(false);
  });

  it("falls back to the extension allowlist for generic content types", () => {
    expect(isSupportedFile("audio.m4a", "application/octet-stream")).toBe(true);
  });

  it("enforces the plan file-size limit", () => {
    const error = validateUpload({
      fileName: "big.mp4",
      contentType: "video/mp4",
      sizeBytes: 600 * 1024 * 1024, // starter caps at 500 MB
      plan: "starter",
      usedTranscriptionMinutesThisPeriod: 0,
    });
    expect(error?.code).toBe("file_too_large");
  });

  it("enforces the plan duration limit", () => {
    const error = validateUpload({
      fileName: "long.mp4",
      contentType: "video/mp4",
      sizeBytes: 10 * 1024 * 1024,
      durationSeconds: 45 * 60, // starter caps at 30 minutes
      plan: "starter",
      usedTranscriptionMinutesThisPeriod: 0,
    });
    expect(error?.code).toBe("duration_too_long");
  });

  it("blocks uploads when monthly transcription minutes are exhausted", () => {
    const error = validateUpload({
      fileName: "demo.mp4",
      contentType: "video/mp4",
      sizeBytes: 1024,
      plan: "starter",
      usedTranscriptionMinutesThisPeriod: 30,
    });
    expect(error?.code).toBe("limit_reached");
  });

  it("passes a valid upload", () => {
    const error = validateUpload({
      fileName: "demo.mp4",
      contentType: "video/mp4",
      sizeBytes: 50 * 1024 * 1024,
      durationSeconds: 10 * 60,
      plan: "professional",
      usedTranscriptionMinutesThisPeriod: 100,
    });
    expect(error).toBeNull();
  });
});
