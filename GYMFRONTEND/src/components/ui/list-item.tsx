import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Row inside a Card. Rows are separated by a hairline; the last one drops it.
 */
export function ListItem({
  title,
  meta,
  right,
  left,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  right?: ReactNode;
  /** Rendered before the title block — e.g. a trainer avatar. */
  left?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-line-soft py-3.5 last:border-b-0",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        {left}
        <div>
          <div className="text-sm font-semibold text-ink">{title}</div>
          {meta && <div className="mt-0.5 text-xs text-steel-soft">{meta}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}
