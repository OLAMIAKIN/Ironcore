import { naira } from "@/lib/format";

/**
 * The gym's earnings in the period, split by where the money currently is:
 * still awaiting the payout run, or already in the bank. Both halves are the
 * gym's own money — this is not a balance and nothing here can be withdrawn.
 */
export function SettlementBar({
  pending,
  settled,
}: {
  pending: number;
  settled: number;
}) {
  const total = pending + settled;
  const settledShare = total === 0 ? 0 : (settled / total) * 100;

  return (
    <div>
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-l-full bg-valid"
          style={{ width: `${settledShare}%` }}
        />
        <div className="h-full flex-1 rounded-r-full bg-token-ink" />
      </div>

      <dl className="mt-3.5 space-y-2.5">
        <Row
          swatch="bg-valid"
          label="In your bank"
          hint="Payout already sent"
          value={naira(settled)}
          share={total === 0 ? "—" : `${settledShare.toFixed(0)}%`}
        />
        <Row
          swatch="bg-token-ink"
          label="Awaiting payout"
          hint="Confirmed, not yet sent"
          value={naira(pending)}
          share={total === 0 ? "—" : `${(100 - settledShare).toFixed(0)}%`}
        />
      </dl>
    </div>
  );
}

function Row({
  swatch,
  label,
  hint,
  value,
  share,
}: {
  swatch: string;
  label: string;
  hint: string;
  value: string;
  share: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="flex items-start gap-2.5">
        <span
          className={`mt-1 size-2.5 shrink-0 rounded-sm ${swatch}`}
          aria-hidden
        />
        <span>
          <span className="block text-[13px] font-semibold text-ink">
            {label}
          </span>
          <span className="block text-xs text-steel-soft">{hint}</span>
        </span>
      </dt>
      <dd className="text-right">
        <span className="block font-mono text-sm font-bold text-ink">
          {value}
        </span>
        <span className="block text-xs text-steel-soft">{share}</span>
      </dd>
    </div>
  );
}
