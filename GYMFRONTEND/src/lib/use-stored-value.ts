"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A single value kept in `localStorage`, read the way React wants an external
 * store read: `useSyncExternalStore` handles the server render (where there is
 * no storage) and the hydration that follows, so nothing has to be nudged into
 * place from an effect afterwards.
 *
 * This is for preferences only — what was on screen last time. Anything that
 * matters belongs on the server.
 */

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab writing the same key should not leave this one stale.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useStoredValue(
  key: string,
): [string | null, (value: string) => void] {
  const read = useCallback(() => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      // Storage can be switched off entirely; the caller falls back to its own
      // default and simply does not remember the choice.
      return null;
    }
  }, [key]);

  const value = useSyncExternalStore(subscribe, read, () => null);

  const write = useCallback(
    (next: string) => {
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Nothing to do — the choice still holds for the rest of this visit.
      }
      listeners.forEach((listener) => listener());
    },
    [key],
  );

  return [value, write];
}
