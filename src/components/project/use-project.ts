"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  apiFetch,
  isProcessingStatus,
  type ProjectResponse,
  type ProjectStatus,
} from "@/components/project/types";

const POLL_INTERVAL_MS = 3000;

export type UseProjectResult = {
  project: ProjectResponse["project"] | null;
  documentId: string | null;
  /** True until the first fetch resolves (success or failure). */
  loading: boolean;
  /** Message when the project itself could not be loaded. */
  loadError: string | null;
  /** Force an immediate re-fetch. */
  refresh: () => Promise<void>;
  /**
   * Optimistically move the project into a processing status (after
   * regenerate/generate) so the pipeline view renders and polling resumes
   * before the next fetch lands.
   */
  beginProcessing: (status: ProjectStatus) => void;
};

/**
 * Fetches the project and polls it every 3 seconds while it is in a
 * processing status. Polling stops on terminal statuses
 * (transcript_ready / ready_for_review / published / failed).
 */
export function useProject(
  workspaceId: string,
  projectId: string,
): UseProjectResult {
  const [data, setData] = useState<ProjectResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const url = `/api/workspaces/${workspaceId}/projects/${projectId}`;

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const body = await apiFetch<ProjectResponse>(url, { cache: "no-store" });
      setData(body);
      setLoadError(null);
    } catch (err) {
      // Keep the last good snapshot on transient poll failures; only surface
      // the error when we have nothing to show.
      setData((prev) => {
        if (!prev) {
          setLoadError(
            err instanceof ApiError
              ? err.message
              : "Could not load this project.",
          );
        }
        return prev;
      });
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const status = data?.project.status;
  const polling = status !== undefined && isProcessingStatus(status);

  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [polling, refresh]);

  const beginProcessing = useCallback(
    (nextStatus: ProjectStatus) => {
      setData((prev) =>
        prev
          ? {
              ...prev,
              project: {
                ...prev.project,
                status: nextStatus,
                errorMessage: null,
              },
            }
          : prev,
      );
      // Pull the real status right away; the interval takes over afterwards.
      void refresh();
    },
    [refresh],
  );

  return {
    project: data?.project ?? null,
    documentId: data?.documentId ?? null,
    loading,
    loadError,
    refresh,
    beginProcessing,
  };
}
