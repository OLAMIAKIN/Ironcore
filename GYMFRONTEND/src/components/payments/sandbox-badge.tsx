import { cn } from "@/lib/cn";

/**
 * Marks every screen that takes a "payment". Nothing here touches a real
 * gateway, and the badge has to say so wherever money is on screen.
 */
export function SandboxBadge({
  className,
  tone = "light",
}: {
  className?: string;
  /** `dark` for the ink surfaces, where the light tint would disappear. */
  tone?: "light" | "dark";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-micro font-bold tracking-[0.4px] uppercase",
        tone === "dark"
          ? "bg-white/10 text-token"
          : "bg-token-dim text-token-ink",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      Sandbox mode
    </span>
  );
}
