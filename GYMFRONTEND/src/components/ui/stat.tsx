import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Two tiles on a phone, four across once there is room for them. */
export function StatGrid({
  children,
  className,
  columns = 2,
}: {
  children: ReactNode;
  className?: string;
  /** Widest column count; the grid still starts at two on a phone. */
  columns?: 2 | 3 | 4;
}) {
  const wide = {
    2: "",
    3: "lg:grid-cols-3",
    4: "sm:grid-cols-4",
  }[columns];

  return (
    <div className={cn("grid grid-cols-2 gap-2.5 lg:gap-4", wide, className)}>
      {children}
    </div>
  );
}

/**
 * The display face is wide, and a tile is narrow. A count fits at any size, but
 * a word like a plan name does not — so a text value steps down a size or two
 * rather than running past the edge of its box.
 */
function sizeFor(value: ReactNode): string {
  const text = typeof value === "string" ? value : String(value ?? "");
  if (!Number.isNaN(Number(text)) || text.length <= 5) {
    return "text-[32px] lg:text-[40px]";
  }
  if (text.length <= 9) return "text-[24px] lg:text-[28px]";
  return "text-[19px] lg:text-[22px]";
}

export function Stat({
  value,
  label,
  hint,
}: {
  value: ReactNode;
  label: string;
  /** Optional delta or context line, e.g. "+12% on last week". */
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-paper p-4 lg:p-5">
      <div
        className={cn(
          "font-display leading-[1.05] break-words text-ink",
          sizeFor(value),
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-micro font-semibold tracking-[0.4px] text-steel-soft uppercase">
        {label}
      </div>
      {hint && <div className="mt-1.5 text-xs text-steel-soft">{hint}</div>}
    </div>
  );
}
