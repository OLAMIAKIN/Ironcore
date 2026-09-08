"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Where the person using the app is.
 *
 * Like the camera, the browser only prompts in response to a real call and only
 * on a secure origin, so nothing here fires on mount — the member presses a
 * button. Everything still works without a position: the gym list simply falls
 * back to alphabetical instead of nearest-first.
 */

export type PositionState =
  | "idle"
  | "locating"
  | "ready"
  /** They said no, or the browser is blocking it. */
  | "denied"
  /** No geolocation here — an insecure origin, or a device without it. */
  | "unavailable"
  | "error";

export type Position = { lat: number; lng: number };

export type PositionQuery = {
  state: PositionState;
  position: Position | null;
  /** Why there is no position, in words worth showing someone. */
  message: string | null;
  locate: () => void;
  clear: () => void;
};

export function usePosition(): PositionQuery {
  const [state, setState] = useState<PositionState>("idle");
  const [position, setPosition] = useState<Position | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // A request can outlive the screen that started it.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("unavailable");
      setMessage(
        typeof window !== "undefined" && !window.isSecureContext
          ? "Location needs HTTPS or localhost. Search by area instead."
          : "This device cannot share a location. Search by area instead.",
      );
      return;
    }

    setState("locating");
    setMessage(null);

    navigator.geolocation.getCurrentPosition(
      (found) => {
        if (!alive.current) return;
        setPosition({
          lat: found.coords.latitude,
          lng: found.coords.longitude,
        });
        setState("ready");
      },
      (cause) => {
        if (!alive.current) return;

        if (cause.code === cause.PERMISSION_DENIED) {
          setState("denied");
          setMessage(
            "Location was blocked. Allow it in your browser's address bar, or search by area.",
          );
        } else if (cause.code === cause.POSITION_UNAVAILABLE) {
          setState("error");
          setMessage("Your location could not be found. Try again outdoors.");
        } else {
          setState("error");
          setMessage("Finding you took too long. Try again.");
        }
      },
      {
        // A gym is a building, so street-level accuracy is plenty and a rough
        // fix arrives far faster than a satellite one.
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 5 * 60_000,
      },
    );
  }, []);

  const clear = useCallback(() => {
    setPosition(null);
    setState("idle");
    setMessage(null);
  }, []);

  return { state, position, message, locate, clear };
}
