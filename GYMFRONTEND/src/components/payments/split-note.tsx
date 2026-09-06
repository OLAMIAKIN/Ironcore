import { cn } from "@/lib/cn";
import { naira } from "@/lib/format";

/**
 * Where the member's money goes, in the member's own words. The figures come
 * from the API's own split, so this cannot drift from what is actually charged.
 *
 * This is the one piece of payment copy that must not read as fine print, so it
 * sits above the pay button at body size rather than under it in grey.
 */
export function SplitNote({
  gymName,
  gymNet,
  platformFee,
  /** Drop the box when the surrounding surface already provides one. */
  bare = false,
  className,
}: {
  gymName: string;
  gymNet: number;
  platformFee: number;
  bare?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        bare
          ? ""
          : "rounded-ctl border border-line bg-chalk p-3.5 text-[13px] leading-[1.55] text-steel",
        className,
      )}
    >
      <p>
        <span className="font-semibold text-ink">
          Your payment is split automatically.
        </span>{" "}
        {gymName} receives {naira(gymNet)} directly, and {naira(platformFee)} is
        a platform fee that keeps IronCore running.
      </p>
      <dl className="mt-2.5 flex gap-4">
        <div>
          <dt className="text-micro font-semibold tracking-[0.4px] text-steel-soft uppercase">
            To {gymName}
          </dt>
          <dd className="font-mono text-sm font-bold text-ink">
            {naira(gymNet)}
          </dd>
        </div>
        <div>
          <dt className="text-micro font-semibold tracking-[0.4px] text-steel-soft uppercase">
            Platform fee
          </dt>
          <dd className="font-mono text-sm font-bold text-ink">
            {naira(platformFee)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
