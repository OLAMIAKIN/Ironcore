"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  CardIcon,
  CheckIcon,
  ClockIcon,
  CrossIcon,
  LockIcon,
} from "@/components/icons";
import { SandboxBadge } from "@/components/payments/sandbox-badge";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { naira } from "@/lib/format";
import { messageOf } from "@/lib/api";
import {
  CHANNELS,
  channelInfo,
  initializePayment,
  simulatePayment,
  waitForPayment,
  type CheckoutSession,
  type InitializeInput,
  type PaymentChannel,
} from "@/lib/payments";

/**
 * The checkout. It collects a channel, asks the API to open a payment, then
 * waits for that payment to settle.
 *
 * No price is passed in and none is posted: the caller says what is being
 * bought, the server answers with what it costs, and this only ever displays
 * the amount that came back.
 */

type Stage = "form" | "processing" | "done" | "failed";

type Fields = { card: string; expiry: string; cvv: string; opayPhone: string };

export type CheckoutSheetProps = {
  open: boolean;
  /** What is being bought, e.g. "IronCore Gym". */
  title: string;
  /** One line under the title, e.g. "Monthly plan · 30 days". */
  context: string;
  /** Everything the API needs to price and open the payment. */
  purchase: InitializeInput;
  /** Rendered above the pay button once the split is known. */
  transparency?: (session: CheckoutSession) => ReactNode;
  /** Fires once the payment is confirmed. */
  onSuccess: (session: CheckoutSession) => void;
  onClose: () => void;
  successTitle: string;
  successBody: (session: CheckoutSession) => ReactNode;
  continueLabel: string;
  onContinue: () => void;
};

const EMPTY: Fields = {
  card: "4084 0840 8408 4081",
  expiry: "09/29",
  cvv: "408",
  opayPhone: "",
};

/** 4084084084081 -> "4084 0840 8408 4081" */
function formatCard(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/** Closed means unmounted, so every checkout starts clean. */
export function CheckoutSheet({ open, ...props }: CheckoutSheetProps) {
  if (!open) return null;
  return <CheckoutDialog {...props} />;
}

function CheckoutDialog({
  title,
  context,
  purchase,
  transparency,
  onSuccess,
  onClose,
  successTitle,
  successBody,
  continueLabel,
  onContinue,
}: Omit<CheckoutSheetProps, "open">) {
  const headingId = useId();
  const cardRef = useRef<HTMLInputElement>(null);

  const [channel, setChannel] = useState<PaymentChannel>(purchase.channel);
  const [stage, setStage] = useState<Stage>("form");
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [shouldFail, setShouldFail] = useState(false);
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (channel === "card") cardRef.current?.focus();
  }, [channel]);

  // Escape closes, but never mid-payment.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && stage !== "processing") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [stage, onClose]);

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStage("processing");
    setError(null);

    try {
      // The server prices it; we only say what and how.
      const opened = await initializePayment({ ...purchase, channel });
      setSession(opened);

      const settled = opened.sandbox
        ? await simulatePayment(
            opened.reference,
            shouldFail ? "failed" : "success",
          )
        : await payThroughGateway(opened);

      setSession(settled);

      if (settled.status === "success") {
        setStage("done");
        onSuccess(settled);
      } else {
        setStage("failed");
        setError(declineFor(channel));
      }
    } catch (cause: unknown) {
      setError(messageOf(cause));
      setStage("failed");
    }
  }

  const info = channelInfo(channel);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-void/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={() => stage !== "processing" && onClose()}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby={headingId}
        onClick={(event) => event.stopPropagation()}
        className="max-h-dvh w-full max-w-[420px] overflow-y-auto rounded-t-card bg-paper shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:rounded-card"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line-soft p-5">
          <div className="min-w-0">
            {(session?.sandbox ?? true) && <SandboxBadge />}
            <h2
              id={headingId}
              className="mt-2.5 font-display text-[24px] leading-none tracking-[0.3px] text-ink"
            >
              {title}
            </h2>
            <p className="mt-1 text-helper text-steel-soft">{context}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={stage === "processing"}
            aria-label="Close checkout"
            className="-mt-1 -mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-steel-soft hover:bg-black/[0.04] hover:text-ink disabled:opacity-40"
          >
            <CrossIcon className="size-5" />
          </button>
        </header>

        {stage === "processing" && <Processing amount={session?.amount} />}

        {stage === "done" && session && (
          <Success
            title={successTitle}
            body={successBody(session)}
            session={session}
            continueLabel={continueLabel}
            onContinue={onContinue}
          />
        )}

        {stage === "failed" && (
          <Failed
            reason={error ?? "The payment did not go through."}
            onRetry={() => {
              setShouldFail(false);
              setStage("form");
            }}
            onClose={onClose}
          />
        )}

        {stage === "form" && (
          <>
            <div
              role="tablist"
              aria-label="Payment method"
              className="flex gap-1.5 border-b border-line-soft px-5 pt-4"
            >
              {CHANNELS.map((option) => {
                const active = option.id === channel;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setChannel(option.id)}
                    className={cn(
                      "-mb-px border-b-2 px-2.5 pb-2.5 text-[13px] font-bold transition-colors",
                      active
                        ? "border-hazard text-ink"
                        : "border-transparent text-steel-soft hover:text-ink",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={pay} className="px-5 pt-4 pb-5" noValidate>
              <p className="mb-4 text-helper leading-[1.5] text-steel-soft">
                {info.blurb}
              </p>

              {channel === "card" && (
                <>
                  <InputField
                    ref={cardRef}
                    label="Card number"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="0000 0000 0000 0000"
                    value={fields.card}
                    onChange={(event) =>
                      set("card", formatCard(event.target.value))
                    }
                    className="font-mono tracking-[1px]"
                  />

                  <div className="grid gap-x-3.5 sm:grid-cols-2">
                    <InputField
                      label="Expiry"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      placeholder="MM/YY"
                      value={fields.expiry}
                      onChange={(event) =>
                        set("expiry", formatExpiry(event.target.value))
                      }
                      className="font-mono"
                    />
                    <InputField
                      label="CVV"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      placeholder="123"
                      value={fields.cvv}
                      onChange={(event) =>
                        set(
                          "cvv",
                          event.target.value.replace(/\D/g, "").slice(0, 4),
                        )
                      }
                      className="font-mono"
                    />
                  </div>
                </>
              )}

              {channel === "opay" && (
                <InputField
                  label="Opay phone number"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="080X XXX XXXX"
                  value={fields.opayPhone}
                  onChange={(event) => set("opayPhone", event.target.value)}
                  className="font-mono"
                />
              )}

              {channel === "transfer" && <TransferHint />}

              {transparency && session && (
                <div className="mb-4 rounded-ctl border border-line bg-chalk p-3.5 text-[13px] leading-[1.55] text-steel">
                  {transparency(session)}
                </div>
              )}

              {error && (
                <p role="alert" className="mb-3 text-xs font-medium text-hazard">
                  {error}
                </p>
              )}

              <Button type="submit" variant="valid">
                {payLabel(channel, session?.amount)}
              </Button>

              <label className="mt-3.5 flex items-start gap-2.5 rounded-ctl border border-dashed border-line-strong p-3">
                <input
                  type="checkbox"
                  checked={shouldFail}
                  onChange={(event) => setShouldFail(event.target.checked)}
                  className="mt-0.5 size-[18px] shrink-0 accent-hazard"
                />
                <span className="text-helper leading-[1.5] text-steel-soft">
                  <span className="font-semibold text-ink">
                    Simulate a failed payment
                  </span>
                  <br />
                  Sandbox only — the API declines this payment so the failure
                  screen can be checked.
                </span>
              </label>

              <p className="mt-3.5 flex items-center justify-center gap-1.5 text-micro tracking-[0.5px] text-steel-soft uppercase">
                <LockIcon className="size-3.5" />
                Payment handled by the API · card details are not stored
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * With a real gateway the payer authorises in Paystack's own window, and the
 * webhook settles it behind them; this polls until that lands.
 */
async function payThroughGateway(
  session: CheckoutSession,
): Promise<CheckoutSession> {
  if (session.authorizationUrl) {
    window.open(session.authorizationUrl, "_blank", "noopener,noreferrer");
  }
  return waitForPayment(session.reference);
}

/**
 * The button carries the real total, not the gym's headline price. Fees are
 * added on top of that price, so this is the last and clearest place to say
 * what is actually leaving the payer's account.
 */
function payLabel(channel: PaymentChannel, amount?: number): string {
  if (channel === "transfer") return "I have sent the money";
  const sum = amount === undefined ? "" : ` ${naira(amount)}`;
  if (channel === "opay") return `Pay${sum} with Opay`;
  return amount === undefined ? "Pay now" : `Pay ${naira(amount)}`;
}

function declineFor(channel: PaymentChannel): string {
  if (channel === "transfer") {
    return "No transfer has landed on this account yet. Nothing was taken.";
  }
  if (channel === "opay") {
    return "The Opay prompt expired before it was approved. Nothing was taken.";
  }
  return "Your bank declined this card. Nothing left your account.";
}

function TransferHint() {
  return (
    <div className="mb-3.5 rounded-ctl border border-line bg-chalk p-4">
      <p className="text-[13px] leading-[1.55] text-steel">
        <span className="font-semibold text-ink">One-time account.</span> Tap the
        button below and the API issues an account for this payment only, valid
        for 30 minutes.
      </p>
    </div>
  );
}

function Processing({ amount }: { amount?: number }) {
  return (
    <div className="flex flex-col items-center px-5 py-14 text-center">
      <span
        className="size-10 animate-spin rounded-full border-[3px] border-line border-t-hazard"
        aria-hidden
      />
      <p className="mt-4 text-btn font-bold text-ink" role="status">
        {amount ? `Authorising ${naira(amount)}…` : "Opening checkout…"}
      </p>
      <p className="mt-1.5 text-helper text-steel-soft">
        Waiting for the bank. Do not close this window.
      </p>
    </div>
  );
}

function Success({
  title,
  body,
  session,
  continueLabel,
  onContinue,
}: {
  title: string;
  body: ReactNode;
  session: CheckoutSession;
  continueLabel: string;
  onContinue: () => void;
}) {
  return (
    <div className="p-5 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-valid-dim text-valid">
        <CheckIcon className="size-7" />
      </div>
      <h3 className="mt-4 font-display text-[26px] leading-none tracking-[0.3px] text-ink">
        {title}
      </h3>
      <p className="mt-2 text-helper leading-[1.55] text-steel-soft">{body}</p>

      <dl className="mt-5 rounded-ctl border border-line bg-chalk p-3.5 text-left">
        <Row label="Amount" value={naira(session.amount)} />
        <Row label="Paid with" value={channelName(session.channel)} />
        <Row label="Reference" value={session.reference} last />
      </dl>

      <div className="mt-5">
        <Button variant="dark" onClick={onContinue}>
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}

function channelName(channel: PaymentChannel): string {
  return channelInfo(channel).label;
}

function Row({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 py-1.5",
        !last && "border-b border-line-soft",
      )}
    >
      <dt className="text-xs text-steel-soft">{label}</dt>
      <dd className="truncate font-mono text-[13px] font-bold text-ink">
        {value}
      </dd>
    </div>
  );
}

function Failed({
  reason,
  onRetry,
  onClose,
}: {
  reason: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="p-5 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-hazard-dim text-hazard">
        <CrossIcon className="size-7" />
      </div>
      <h3 className="mt-4 font-display text-[26px] leading-none tracking-[0.3px] text-ink">
        Payment failed
      </h3>
      <p role="alert" className="mt-2 text-helper leading-[1.55] text-steel-soft">
        {reason}
      </p>

      <div className="mt-5 space-y-2.5">
        <Button onClick={onRetry}>
          <CardIcon className="size-4" />
          Try again
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>

      <p className="mt-3.5 flex items-center justify-center gap-1.5 text-micro text-steel-soft">
        <ClockIcon className="size-3.5" />
        Nothing was charged
      </p>
    </div>
  );
}
