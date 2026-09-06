"use client";

import { cn } from "@/lib/cn";
import { daysLeftLabel } from "@/lib/format";
import type { MemberSubscription } from "@/lib/domain";

/**
 * Which gym's card is on screen. A member can train at several gyms at once —
 * relocating means adding one, not replacing one — and each membership has its
 * own door code, so the desk scans the code for the gym they are standing in.
 */
export function GymSwitcher({
  memberships,
  activeId,
  onSelect,
}: {
  memberships: MemberSubscription[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  if (memberships.length < 2) return null;

  return (
    <div
      role="tablist"
      aria-label="Your gyms"
      className="mb-4 flex gap-2.5 overflow-x-auto pb-1"
    >
      {memberships.map((row) => {
        const active = row.id === activeId;
        const live = row.daysLeft > 0;

        return (
          <button
            key={row.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(row.id)}
            className={cn(
              "shrink-0 rounded-ctl border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
              active
                ? "border-ink bg-ink text-white"
                : "border-line bg-paper text-ink hover:border-line-strong",
            )}
          >
            <span className="block text-[13px] font-bold">{row.gym.name}</span>
            <span
              className={cn(
                "mt-0.5 block text-2xs",
                active ? "text-mist" : "text-steel-soft",
              )}
            >
              {row.gym.branch} ·{" "}
              <span className={live ? undefined : "text-hazard"}>
                {live ? daysLeftLabel(row.daysLeft) : "Expired"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
