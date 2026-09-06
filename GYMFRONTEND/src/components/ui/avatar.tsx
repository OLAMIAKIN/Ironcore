import { cn } from "@/lib/cn";
import { initialsOf } from "@/lib/format";

export function Avatar({
  name,
  initials,
  tone = "ink",
  className,
}: {
  /** Full name — initials are derived from it when `initials` is omitted. */
  name?: string;
  initials?: string;
  tone?: "ink" | "steel";
  className?: string;
}) {
  const text = initials ?? initialsOf(name ?? "");

  return (
    <div
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white",
        tone === "ink" ? "bg-ink" : "bg-steel",
        className,
      )}
    >
      {text}
    </div>
  );
}
