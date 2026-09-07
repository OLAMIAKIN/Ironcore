"use client";

import { useState } from "react";
import { ArrowRightIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { DarkCard } from "@/components/ui/card";
import { Pill, type PillTone } from "@/components/ui/pill";
import { QrCode } from "@/components/ui/qr-code";
import { cn } from "@/lib/cn";
import { daysLeftLabel } from "@/lib/format";
import { setAutoRenew, type MemberSubscription } from "@/lib/domain";

const STATUS: Record<string, { tone: PillTone; label: string }> = {
  active: { tone: "valid", label: "Active" },
  expiring: { tone: "token", label: "Expiring" },
  expired: { tone: "hazard", label: "Expired" },
  pending: { tone: "token", label: "Pending" },
  cancelled: { tone: "hazard", label: "Cancelled" },
};

/**
 * The dark membership card with the check-in code. Stacked on a phone; the code
 * moves beside the details once the card is wide enough to hold both.
 */
export function MembershipCard({
  membership,
  onChanged,
}: {
  membership: MemberSubscription;
  /** Refetches the memberships once a setting on this card has been saved. */
  onChanged?: () => void;
}) {
  const { gym, plan, daysLeft, autoRenew, qrToken } = membership;

  // Renewing from this card means renewing *this* gym, not whichever gym the
  // subscribe screen would have guessed at.

  // "Expiring" is a reading of the clock, not a state the API stores.
  const key =
    membership.status === "active" && daysLeft <= 5 ? "expiring" : membership.status;
  const badge = STATUS[key] ?? STATUS.active!;

  return (
    <DarkCard className="lg:p-8">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8 lg:gap-12">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-micro font-semibold tracking-[1px] text-mist uppercase">
                {gym.name} — {gym.branch}
              </p>
              <p className="mt-1 font-display text-2xl tracking-[0.5px] lg:text-[34px]">
                {plan.name} Plan
              </p>
            </div>
            <Pill tone={badge.tone} dot={membership.status === "active"}>
              {badge.label}
            </Pill>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-5">
            <div>
              <dt className="text-2xs font-semibold tracking-[1px] text-mist-dim uppercase">
                Time left
              </dt>
              <dd className="mt-1 font-mono text-sm font-bold">
                {daysLeftLabel(daysLeft)}
              </dd>
            </div>
            <div>
              <dt className="text-2xs font-semibold tracking-[1px] text-mist-dim uppercase">
                Auto-renew
              </dt>
              <dd className="mt-1">
                <AutoRenewToggle
                  subscriptionId={membership.id}
                  on={autoRenew}
                  onChanged={onChanged}
                />
              </dd>
            </div>
          </dl>

          <ButtonLink
            href={`/subscribe?gym=${gym.id}`}
            variant="primary"
            className="mt-6 w-full sm:w-auto sm:px-6"
            fullWidth={false}
          >
            Renew subscription
            <ArrowRightIcon className="size-4" />
          </ButtonLink>
        </div>

        <div className="justify-self-center">
          <QrCode
            value={qrToken}
            label={`Check-in code for ${gym.name}`}
            className="size-[190px] lg:size-[210px]"
          />
          <p className="mt-2.5 text-center font-mono text-micro tracking-[1px] text-mist-dim">
            {qrToken}
          </p>
        </div>
      </div>
    </DarkCard>
  );
}

/**
 * Renewal is the member's own choice, so it is a control rather than a label.
 * The new value shows the moment it is pressed and rolls back if the save
 * fails — nobody should be left unsure whether they are on a recurring charge.
 */
function AutoRenewToggle({
  subscriptionId,
  on,
  onChanged,
}: {
  subscriptionId: string;
  on: boolean;
  onChanged?: () => void;
}) {
  const [pending, setPending] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const shown = pending ?? on;

  async function toggle() {
    const next = !shown;
    setPending(next);
    setFailed(false);
    try {
      await setAutoRenew(subscriptionId, next);
      onChanged?.();
    } catch {
      setPending(null);
      setFailed(true);
    }
  }

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={shown}
        aria-label="Renew this membership automatically"
        onClick={() => void toggle()}
        className="flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hazard"
      >
        <span
          aria-hidden
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full transition-colors",
            shown ? "bg-valid" : "bg-white/25",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-4 rounded-full bg-white transition-all",
              shown ? "left-[18px]" : "left-0.5",
            )}
          />
        </span>
        <span className="font-mono text-sm font-bold">
          {shown ? "On" : "Off"}
        </span>
      </button>
      {failed && (
        <span role="alert" className="mt-1 block text-2xs text-hazard">
          Could not save — try again
        </span>
      )}
    </>
  );
}
