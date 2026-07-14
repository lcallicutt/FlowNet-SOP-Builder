"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type PendingTask = {
  timer: ReturnType<typeof setTimeout>;
  task: () => Promise<boolean>;
};

/**
 * Debounced save queue for the document editor.
 *
 * - `run(task)`  — execute a save task immediately and track its status.
 * - `queue(key, task)` — debounce a save task per key (800ms); repeated calls
 *   with the same key replace the pending task so only the latest state saves.
 *
 * Tasks return `true` on success and `false` on failure (they are expected to
 * surface their own error toasts). The exposed status drives the header's
 * "Saving… / Saved" indicator.
 */
export function useSaveQueue(debounceMs = 800) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const pending = useRef(new Map<string, PendingTask>());
  const inflight = useRef(0);
  const hadError = useRef(false);

  const run = useCallback(
    async (task: () => Promise<boolean>): Promise<boolean> => {
      inflight.current += 1;
      setStatus("saving");
      let ok = false;
      try {
        ok = await task();
      } catch {
        ok = false;
      }
      inflight.current -= 1;
      if (!ok) hadError.current = true;
      if (inflight.current === 0) {
        setStatus(hadError.current ? "error" : "saved");
        hadError.current = false;
      }
      return ok;
    },
    [],
  );

  const queue = useCallback(
    (key: string, task: () => Promise<boolean>) => {
      const existing = pending.current.get(key);
      if (existing) clearTimeout(existing.timer);
      const timer = setTimeout(() => {
        pending.current.delete(key);
        void run(task);
      }, debounceMs);
      pending.current.set(key, { timer, task });
    },
    [debounceMs, run],
  );

  // Flush anything still pending when the editor unmounts so quick
  // navigations don't lose the last keystrokes.
  useEffect(() => {
    const map = pending.current;
    return () => {
      for (const { timer, task } of map.values()) {
        clearTimeout(timer);
        void task();
      }
      map.clear();
    };
  }, []);

  return { status, run, queue };
}
