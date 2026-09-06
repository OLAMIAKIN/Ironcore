import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PillTone = "valid" | "hazard" | "token";

const TONES: Record<PillTone, string> = {
  valid: "bg-valid-dim text-valid",
  hazard: "bg-hazard-dim text-hazard",
  token: "bg-token-dim text-token-ink",
};

export function Pill({
  children,
  tone,
  dot = false,
  className,
}: {
  children: ReactNode;
  tone: PillTone;
  /** Small status dot, as on the "Active" membership pill. */
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-micro font-bold tracking-[0.4px] uppercase",
        TONES[tone],
        className,
      )}
    >
      {dot && (
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
      )}
      {children}
    </span>
  );
}
