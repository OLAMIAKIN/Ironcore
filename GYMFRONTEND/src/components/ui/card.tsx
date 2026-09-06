import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Cards carry no outer margin — stack them with `space-y-*` or a grid so the
 * same component works in a single column and in a multi-column layout.
 */
export function Card({
  children,
  className,
  selected = false,
}: {
  children: ReactNode;
  className?: string;
  /** Draws the 2px ink outline the mockup uses for the highlighted plan card. */
  selected?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-card bg-paper p-[18px] shadow-[0_1px_0_rgba(0,0,0,0.04)] lg:p-5",
        selected ? "border-2 border-ink" : "border border-line",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DarkCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-card bg-ink p-5 text-white lg:p-6", className)}>
      {children}
    </div>
  );
}
