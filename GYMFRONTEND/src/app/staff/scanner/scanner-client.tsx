"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import { CheckIcon, CrossIcon, ScanIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { messageOf } from "@/lib/api";
import { scanToken, useMyGym, type ScanResult } from "@/lib/domain";
import {
  useQrScanner,
  type QrScanner,
  type ScannerState,
} from "@/lib/use-qr-scanner";

type LogEntry = ScanResult & { id: number; token: string; at: string };

function now(): string {
  return new Date().toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ScannerClient() {
  const gym = useMyGym();
  const [token, setToken] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // The camera fires far faster than the API answers. This keeps a second
  // frame of the same card from opening a second request mid-flight.
  const busy = useRef(false);

  /**
   * The door rule lives on the server: this only shows what it decided, and a
   * pass is consumed there so two scanners cannot both let the same guest in.
   */
  const scan = useCallback(async function scan(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setError("Enter or scan a code first");
      return;
    }
    if (!gym.data) {
      setError("Still loading your gym — try again in a moment");
      return;
    }
    if (busy.current) return;

    busy.current = true;
    setChecking(true);
    setError(null);

    try {
      const outcome = await scanToken(gym.data.id, trimmed);
      setResult(outcome);
      setLog((entries) =>
        [
          {
            ...outcome,
            id: Date.now(),
            token: trimmed.toUpperCase(),
            at: now(),
          },
          ...entries,
        ].slice(0, 6),
      );
    } catch (cause: unknown) {
      setError(messageOf(cause));
    } finally {
      busy.current = false;
      setChecking(false);
    }
  }, [gym.data]);

  /**
   * A membership QR may carry the bare token or a whole check-in URL, depending
   * on what printed it. Either way the door only cares about the last segment.
   */
  const onDetect = useCallback(
    (value: string) => {
      const token = value.includes("/") ? (value.split("/").pop() ?? value) : value;
      setToken(token);
      void scan(token);
    },
    [scan],
  );

  const camera = useQrScanner(onDetect);

  /** Clears the last verdict and lets the camera look again. */
  function scanNext() {
    setResult(null);
    setToken("");
    setError(null);
    camera.resume();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void scan(token);
  }

  function reset() {
    setResult(null);
    setToken("");
    setError(null);
    // A manual reset is also a "ready for the next one", if the camera is on.
    camera.resume();
  }

  return (
    <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-stretch">
      <GateScene
        result={result}
        cameraState={camera.state}
        videoRef={camera.videoRef}
        gymName={
          gym.data ? `${gym.data.name} — ${gym.data.branch}` : "Front desk"
        }
      />

      <aside className="border-t border-white/10 bg-ink px-5 py-6 lg:border-t-0 lg:border-l lg:px-7 lg:py-8">
        <h1 className="font-display text-[26px] leading-none tracking-[0.5px] lg:text-[32px]">
          Door check
        </h1>
        <p className="mt-2 text-helper leading-[1.5] text-mist-dim">
          Hold a code up to the camera, or type it in if the screen is cracked
          or the battery is dead.
        </p>

        <CameraControls camera={camera} onScanNext={scanNext} />

        <form onSubmit={handleSubmit} className="mt-5">
          <label
            htmlFor="token"
            className="mb-1.5 block text-micro font-semibold tracking-[1px] text-mist uppercase"
          >
            Member or guest code
          </label>
          <input
            id="token"
            value={token}
            onChange={(event) => {
              setToken(event.target.value);
              if (error) setError(null);
            }}
            placeholder="MBR-001-… or TKN-8842-XQ"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            className={cn(
              "w-full rounded-ctl border-[1.5px] bg-ink-soft px-3.5 py-3 font-mono text-sm tracking-[1px] text-white uppercase placeholder:text-slate-dim placeholder:normal-case focus:outline-2 focus:outline-offset-1 focus:outline-hazard",
              error ? "border-hazard" : "border-white/15",
            )}
          />
          {error && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-hazard">
              {error}
            </p>
          )}

          <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
            <Button type="submit">
              <ScanIcon className="size-[18px]" />
              {checking ? "Checking…" : "Check code"}
            </Button>
            <Button
              variant="ghost"
              disabled={checking}
              onClick={reset}
              className="border-white/20 text-mist hover:bg-white/5"
            >
              Reset gate
            </Button>
          </div>
        </form>

        <p className="mt-6 text-helper leading-[1.5] text-mist-dim">
          Codes are checked against this gym only. A member code from another
          branch, or a pass already scanned today, is turned away here.
        </p>

        {log.length > 0 && (
          <>
            <p className="mt-7 text-micro font-semibold tracking-[1px] text-mist-dim uppercase">
              This session
            </p>
            <ul className="mt-2 divide-y divide-white/10">
              {log.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs tracking-[0.5px] text-white">
                      {entry.token}
                    </p>
                    <p className="text-2xs text-mist-dim">{entry.at}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-2xs font-bold tracking-[0.4px] uppercase",
                      entry.allowed
                        ? "bg-valid-dim text-valid"
                        : "bg-hazard-dim text-hazard",
                    )}
                  >
                    {entry.allowed ? "Allowed" : "Denied"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {result && !result.allowed && result.offerRenewal && (
          <ChaseRenewal contact={result.contact} />
        )}
      </aside>
    </div>
  );
}

/**
 * The camera button and whatever the browser had to say about the request.
 * Turning the camera on is deliberately a press: the permission prompt only
 * appears in response to one, and a desk that has already been asked once
 * should not be re-prompted every time this screen mounts.
 */
function CameraControls({
  camera,
  onScanNext,
}: {
  camera: QrScanner;
  onScanNext: () => void;
}) {
  const live =
    camera.state === "scanning" ||
    camera.state === "starting" ||
    camera.state === "paused";

  return (
    <div className="mt-4 space-y-2.5">
      {/*
        After a read the camera stops looking, so the verdict on screen stays
        put and the same card is not waved through twice. The desk decides when
        the next person is ready.
      */}
      {camera.state === "paused" && (
        <Button type="button" onClick={onScanNext}>
          <ScanIcon className="size-[18px]" />
          Scan next person
        </Button>
      )}

      <Button
        type="button"
        variant={live ? "ghost" : "primary"}
        // Still pressable while the prompt is open, so an ignored permission
        // dialog does not strand the desk on a dead button.
        onClick={live ? camera.stop : camera.start}
        className={
          live ? "border-white/20 text-mist hover:bg-white/5" : undefined
        }
      >
        <ScanIcon className="size-[18px]" />
        {camera.state === "starting"
          ? "Waiting for camera…"
          : live
            ? "Stop camera"
            : "Start camera"}
      </Button>

      {camera.message && (
        <p
          role="status"
          className="mt-2 text-helper leading-[1.5] text-hazard"
        >
          {camera.message}
        </p>
      )}
    </div>
  );
}

/** The barrier, the viewfinder and the verdict. */
function GateScene({
  result,
  cameraState,
  videoRef,
  gymName,
}: {
  result: ScanResult | null;
  cameraState: ScannerState;
  videoRef: QrScanner["videoRef"];
  gymName: string;
}) {
  const allowed = result?.allowed ?? false;
  // The stream is on screen while scanning and while paused; only the decoding
  // stops between people, so the viewfinder should not blink out.
  const on = cameraState === "scanning" || cameraState === "paused";
  const live = cameraState === "scanning";

  return (
    <section className="relative flex min-h-[420px] flex-1 flex-col items-center justify-center overflow-hidden bg-ink px-5 py-10 lg:min-h-0">
      <div className="absolute inset-y-0 left-4 w-3.5 bg-void sm:left-8 lg:left-12" />
      <div className="absolute inset-y-0 right-4 w-3.5 bg-void sm:right-8 lg:right-12" />

      <div
        aria-hidden
        className={cn(
          "absolute top-1/2 left-4 h-3.5 w-[min(60%,240px)] origin-left rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.4)] transition-transform duration-500 [transition-timing-function:cubic-bezier(.4,1.6,.6,1)] sm:left-8 lg:left-12",
          allowed
            ? "-rotate-[72deg] bg-valid"
            : "bg-[repeating-linear-gradient(90deg,#ff5a36_0,#ff5a36_16px,#fff_16px,#fff_32px)]",
        )}
      />

      <div
        className={cn(
          "relative z-10 flex size-[210px] items-center justify-center overflow-hidden rounded-[20px] border-2 text-center font-mono text-xs sm:size-[250px]",
          result
            ? allowed
              ? "border-valid text-valid"
              : "border-hazard text-hazard"
            : on
              ? "border-solid border-hazard text-mist"
              : "border-dashed border-steel text-slate-dim",
        )}
      >
        {/*
          The video stays mounted whenever the camera is on, even behind a
          verdict: tearing it down between scans would restart the stream and
          make the next member wait for the camera to warm up again.
        */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={cn(
            "absolute inset-0 size-full object-cover",
            on ? "opacity-100" : "opacity-0",
            result && "opacity-25",
          )}
        />

        {result ? (
          <span className="relative flex flex-col items-center gap-2 rounded-lg bg-ink/70 px-3 py-2">
            {allowed ? (
              <CheckIcon className="size-9" />
            ) : (
              <CrossIcon className="size-9" />
            )}
            Scan complete
          </span>
        ) : live ? (
          <span className="relative rounded-lg bg-ink/70 px-2.5 py-1.5 text-mist">
            Hold the code steady
          </span>
        ) : cameraState === "paused" ? (
          <span className="relative rounded-lg bg-ink/70 px-2.5 py-1.5 text-mist">
            Press &ldquo;Scan next person&rdquo;
          </span>
        ) : cameraState === "starting" ? (
          "Waiting for camera…"
        ) : (
          "Start the camera, or type the code"
        )}
      </div>

      <div className="z-10 mt-7 max-w-sm text-center" aria-live="polite">
        {result ? (
          <>
            <p
              className={cn(
                "font-display text-[30px] tracking-[1px] uppercase lg:text-[38px]",
                allowed ? "text-valid" : "text-hazard",
              )}
            >
              {result.status}
            </p>
            <p className="mt-1 text-[13px] text-mist">{result.detail}</p>
          </>
        ) : (
          <p className="text-[13px] text-mist-dim">
            {gymName} ·{" "}
            {live
              ? "scanning"
              : cameraState === "paused"
                ? "paused"
                : "ready to scan"}
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * What the desk can actually do about an expired membership.
 *
 * There is no email or SMS gateway wired up, so nothing can be "sent" from
 * here — a button claiming otherwise would just be a lie the desk believes.
 * Instead this hands over the member's number: one tap opens WhatsApp with the
 * message already written, or dials them.
 */
function ChaseRenewal({
  contact,
}: {
  contact?: { name: string; phone: string };
}) {
  if (!contact) {
    return (
      <p className="mt-6 text-helper leading-[1.5] text-mist-dim">
        Their plan has run out. They can renew in the app, or at this desk.
      </p>
    );
  }

  // WhatsApp wants a full international number with no punctuation. Nigerian
  // numbers are stored as "080…", which is "23480…" once the trunk 0 is gone.
  const digits = contact.phone.replace(/\D/g, "");
  const international = digits.startsWith("0") ? `234${digits.slice(1)}` : digits;
  const message = encodeURIComponent(
    `Hi ${contact.name.split(" ")[0]}, your gym membership has expired. You can renew in the IronCore app or at the front desk.`,
  );

  return (
    <div className="mt-6">
      <p className="text-micro font-semibold tracking-[1px] text-mist-dim uppercase">
        Remind them
      </p>
      <p className="mt-1.5 font-mono text-sm text-white">{contact.phone}</p>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
        <a
          href={`https://wa.me/${international}?text=${message}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 items-center justify-center rounded-ctl bg-valid px-4 text-btn font-bold text-white transition-opacity hover:opacity-90"
        >
          Message on WhatsApp
        </a>
        <a
          href={`tel:${contact.phone}`}
          className="flex h-11 items-center justify-center rounded-ctl border border-white/20 px-4 text-btn font-bold text-mist transition-colors hover:bg-white/5"
        >
          Call {contact.name.split(" ")[0]}
        </a>
      </div>
    </div>
  );
}
