"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, messageOf } from "./api";

/**
 * Minimal read hook: fetch on mount, expose loading and error, and hand back a
 * `reload` for after a write. No cache — every screen here is small and the
 * data is money, so a stale read is worse than a second request.
 */
export type Query<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

/**
 * What came back, and which request it came back for. Keeping the path in state
 * lets `loading` be derived during render: a result for a different path is by
 * definition stale, so there is nothing to reset when the path changes.
 */
type Settled<T> = {
  path: string | null;
  nonce: number;
  data: T | null;
  error: string | null;
};

export function useApi<T>(
  path: string | null,
  options: { skip?: boolean } = {},
): Query<T> {
  const enabled = path !== null && !options.skip;
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled<T>>({
    path: null,
    nonce: -1,
    data: null,
    error: null,
  });

  // Guards against a slower earlier request landing after a newer one.
  const latest = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const ticket = ++latest.current;

    api
      .get<T>(path)
      .then((result) => {
        if (ticket === latest.current) {
          setSettled({ path, nonce, data: result, error: null });
        }
      })
      .catch((cause: unknown) => {
        if (ticket === latest.current) {
          setSettled({ path, nonce, data: null, error: messageOf(cause) });
        }
      });
  }, [path, enabled, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  const fresh = settled.path === path && settled.nonce === nonce;

  return {
    data: fresh ? settled.data : null,
    error: fresh ? settled.error : null,
    loading: enabled && !fresh,
    reload,
  };
}

/** Wraps a write so a screen gets pending and error state without ceremony. */
export function useAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
): {
  run: (...args: TArgs) => Promise<TResult | null>;
  pending: boolean;
  error: string | null;
  clearError: () => void;
} {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: TArgs) => {
      setPending(true);
      setError(null);
      try {
        return await action(...args);
      } catch (cause: unknown) {
        setError(messageOf(cause));
        return null;
      } finally {
        setPending(false);
      }
    },
    [action],
  );

  return { run, pending, error, clearError: () => setError(null) };
}
