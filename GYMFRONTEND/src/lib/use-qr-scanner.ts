"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Camera QR scanning for the front desk.
 *
 * The browser only shows its "allow camera?" prompt in response to a real
 * `getUserMedia` call, and only on a secure origin. Nothing here runs on mount:
 * the desk presses a button, the prompt appears, and the answer is reflected in
 * `state` so the screen can say what went wrong instead of sitting blank.
 */

export type ScannerState =
  /** Camera is off — either not started yet, or stopped. */
  | "idle"
  /** Permission has been asked for and we are waiting on the answer. */
  | "starting"
  /** Frames are being read. */
  | "scanning"
  /**
   * A code was read and the camera is deliberately not looking any more. The
   * stream stays open so the next person does not wait for it to warm up again.
   */
  | "paused"
  /** The user said no, or the browser is blocking the camera. */
  | "denied"
  /** No camera API here — an insecure origin, or a device without one. */
  | "unavailable"
  | "error";

/** Frames are cheap to grab but not to decode. Roughly ten looks a second. */
const DECODE_INTERVAL_MS = 100;

export type QrScanner = {
  state: ScannerState;
  /** Why the camera is unavailable, in words the front desk can act on. */
  message: string | null;
  /** Attach to the `<video>` element that shows the viewfinder. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  start: () => void;
  stop: () => void;
  /** Stop reading frames but keep the camera on. */
  pause: () => void;
  /** Look again, after a pause. */
  resume: () => void;
};

export function useQrScanner(onDetect: (value: string) => void): QrScanner {
  const [state, setState] = useState<ScannerState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Kept in a ref so a new callback identity is never a reason to tear the
  // decode loop down and restart the camera mid-queue.
  const detectRef = useRef(onDetect);
  useEffect(() => {
    detectRef.current = onDetect;
  }, [onDetect]);

  /**
   * Set the moment a code is read, and cleared only by `resume`. A card sits in
   * front of the lens for seconds after it is scanned, and ten looks a second
   * would otherwise re-read it over and over — so one read closes the door
   * until the desk says go again.
   */
  const pausedRef = useRef(false);

  /**
   * Bumped by every start and stop. The permission prompt is open for as long
   * as the desk takes to answer it, so a resolved `getUserMedia` has to prove
   * it still belongs to the current attempt before it touches anything.
   */
  const runRef = useRef(0);

  const stop = useCallback(() => {
    runRef.current += 1;

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    const video = videoRef.current;
    if (video) video.srcObject = null;

    pausedRef.current = false;
    setState("idle");
    setMessage(null);
  }, []);

  /**
   * Stops reading without dropping the stream. The verdict for the code just
   * read stays on screen until the desk waves the next person through.
   */
  const pause = useCallback(() => {
    if (!streamRef.current) return;
    pausedRef.current = true;
    setState("paused");
  }, []);

  const resume = useCallback(() => {
    if (!streamRef.current) return;
    pausedRef.current = false;
    setState("scanning");
  }, []);

  const start = useCallback(() => {
    // `mediaDevices` is missing entirely on an insecure origin, which is the
    // usual reason this fails on a phone pointed at a dev machine's IP.
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      setMessage(
        typeof window !== "undefined" && !window.isSecureContext
          ? "The camera only works over HTTPS or on localhost. Type the code in instead."
          : "This device has no camera the browser can use. Type the code in instead.",
      );
      return;
    }

    setState("starting");
    setMessage(null);

    const run = (runRef.current += 1);
    const current = () => runRef.current === run;

    void (async () => {
      try {
        // The rear camera on a phone; a laptop simply ignores the hint.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });

        // The desk may have pressed stop while the prompt was open.
        if (!current()) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) {
          stop();
          return;
        }

        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.muted = true;
        await video.play();
        if (!current()) return;

        setState("scanning");

        const { default: jsQR } = await import("jsqr");
        if (!current()) return;

        const canvas =
          canvasRef.current ?? (canvasRef.current = document.createElement("canvas"));
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          setState("error");
          setMessage("This browser cannot read frames from the camera.");
          return;
        }

        let lastDecode = 0;

        const tick = (now: number) => {
          frameRef.current = requestAnimationFrame(tick);

          if (pausedRef.current) return;
          if (now - lastDecode < DECODE_INTERVAL_MS) return;
          lastDecode = now;

          const { videoWidth: width, videoHeight: height } = video;
          if (!width || !height) return;

          canvas.width = width;
          canvas.height = height;
          context.drawImage(video, 0, 0, width, height);

          const frame = context.getImageData(0, 0, width, height);
          const found = jsQR(frame.data, width, height, {
            inversionAttempts: "dontInvert",
          });

          const value = found?.data.trim();
          if (!value) return;

          // One read per press of "Scan next". Without this the same card in
          // front of the lens is read ten times a second.
          pausedRef.current = true;
          setState("paused");
          detectRef.current(value);
        };

        frameRef.current = requestAnimationFrame(tick);
      } catch (cause: unknown) {
        if (!current()) return;

        const name = cause instanceof DOMException ? cause.name : "";

        if (name === "NotAllowedError" || name === "SecurityError") {
          setState("denied");
          setMessage(
            "Camera access was blocked. Allow it in your browser's address bar, then start the camera again.",
          );
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setState("unavailable");
          setMessage("No camera was found on this device. Type the code in instead.");
        } else if (name === "NotReadableError") {
          setState("error");
          setMessage(
            "Another app is using the camera. Close it and start the camera again.",
          );
        } else {
          setState("error");
          setMessage("The camera could not be started. Type the code in instead.");
        }

        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    })();
  }, [stop]);

  // Never leave the camera light on behind a navigation.
  useEffect(() => stop, [stop]);

  return { state, message, videoRef, start, stop, pause, resume };
}
