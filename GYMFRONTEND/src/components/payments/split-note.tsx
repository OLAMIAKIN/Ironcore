import { cn } from "@/lib/cn";
import { naira } from "@/lib/format";
import { feesOf } from "@/lib/payments";

/**
 * Where the member's money goes, in the member's own words. The figures come
 * from the API's own split, so this cannot drift from what is actually charged.
 *
 * The gym's price and the fees are shown as separate lines that add up to the
 * total, because that is what is happening: the fees are charged on top so the
 * gym receives its quoted price whole. Rolling them into one number would hide
 * the very thing the payer is entitled to see.
 *
 * This is the one piece of payment copy that must not read as fine print, so it
 * sits above the pay button at body size rather than under it in grey.
 */
export function SplitNote({
  gymName,
  gymNet,
  platformFee,
  gatewayFee,
  /** Drop the box when the surrounding surface already provides one. */
  bare = false,
  className,
}: {
  gymName: string;
  gymNet: number;
  platformFee: number;
  gatewayFee: number;
  bare?: boolean;
  className?: string;
}) {
  const fees = feesOf({ platformFee, gatewayFee });
  const total = gymNet + fees;

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
          {gymName} receives {naira(gymNet)} in full.
        </span>{" "}
        The card and platform charges are added on top rather than taken out of
        what the gym is paid.
      </p>

      <dl className="mt-2.5 space-y-1.5">
        <Row label={`To ${gymName}`} value={gymNet} />
        <Row label="Card & platform charges" value={fees} />
        <div className="flex items-baseline justify-between gap-3 border-t border-line-soft pt-1.5">
          <dt className="text-micro font-semibold tracking-[0.4px] text-ink uppercase">
            You pay
          </dt>
          <dd className="font-mono text-sm font-bold text-ink">
            {naira(total)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-micro font-semibold tracking-[0.4px] text-steel-soft uppercase">
        {label}
      </dt>
      <dd className="font-mono text-sm font-bold text-ink">{naira(value)}</dd>
    </div>
  );
}
