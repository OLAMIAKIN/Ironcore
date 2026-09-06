"use client";

import { useState } from "react";
import { GymLabel } from "@/components/admin/gym-label";
import { BankIcon, ClockIcon } from "@/components/icons";
import {
  Container,
  Helper,
  PageHeader,
  Section,
  Split,
} from "@/components/layout/page";
import { EarningsChart } from "@/components/payments/earnings-chart";
import { SettlementBar } from "@/components/payments/settlement-bar";
import { Card } from "@/components/ui/card";
import { ListItem } from "@/components/ui/list-item";
import { Pill } from "@/components/ui/pill";
import { Stat, StatGrid } from "@/components/ui/stat";
import { cn } from "@/lib/cn";
import { naira, nairaCompact } from "@/lib/format";
import {
  useMyGym,
  useOwnerDaily,
  useOwnerPayments,
  useOwnerSummary,
  useSettlements,
  type OwnerPaymentRow,
} from "@/lib/domain";

/**
 * The owner's money screen. Every figure on it is the gym's own share — the
 * API's owner endpoints do not return the platform fee or the gross amount at
 * all, so there is nothing to hide in the UI and nothing to find in the network
 * tab either.
 */

const PERIODS = [
  { id: 7, label: "Last 7 days" },
  { id: 14, label: "Last 14 days" },
  { id: 90, label: "Last 90 days" },
];

export function PaymentsClient() {
  const [days, setDays] = useState(14);
  const gym = useMyGym();
  const gymId = gym.data?.id;

  const summary = useOwnerSummary(gymId, days);
  const daily = useOwnerDaily(gymId, days);
  const payments = useOwnerPayments(gymId, days);
  const settlements = useSettlements(gymId);

  const loading =
    gym.loading || summary.loading || daily.loading || payments.loading;

  const account = gym.data?.settlementAccount;

  return (
    <Container>
      <PageHeader
        label={<GymLabel />}
        title="Payments"
        description="What your members paid you, and whether it has reached your bank yet."
      />

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Period">
        {PERIODS.map((period) => (
          <button
            key={period.id}
            type="button"
            onClick={() => setDays(period.id)}
            aria-pressed={period.id === days}
            className={cn(
              "rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors",
              period.id === days
                ? "bg-ink text-white"
                : "border border-line bg-paper text-steel hover:border-line-strong",
            )}
          >
            {period.label}
          </button>
        ))}
      </div>

      {summary.error && (
        <Card className="mb-6 border-hazard/40 bg-hazard-dim">
          <p className="text-btn font-bold">{summary.error}</p>
        </Card>
      )}

      {loading ? (
        <PaymentsSkeleton />
      ) : (
        <Split
          main={
            <>
              <Section className="mb-0">
                <StatGrid columns={4}>
                  <Stat
                    value={nairaCompact(summary.data?.earned ?? 0)}
                    label="You earned"
                    hint={`${summary.data?.payments ?? 0} payments`}
                  />
                  <Stat
                    value={nairaCompact(summary.data?.settled ?? 0)}
                    label="In your bank"
                    hint="Payouts completed"
                  />
                  <Stat
                    value={nairaCompact(summary.data?.pendingSettlement ?? 0)}
                    label="Awaiting payout"
                    hint="Not in your bank yet"
                  />
                  <Stat
                    value={summary.data?.activeMembers ?? 0}
                    label="Active members"
                    hint="Cover still running"
                  />
                </StatGrid>
              </Section>

              <Section title="What you earned per day" className="mt-6">
                <Card>
                  <EarningsChart
                    data={(daily.data?.items ?? []).map((point) => ({
                      date: point.date,
                      label: shortDate(point.date),
                      amount: point.amount,
                    }))}
                  />
                </Card>
                <Helper className="mt-2.5">
                  Your share of each payment, on the day it was made. Hover a day
                  for the exact figure.
                </Helper>
              </Section>

              <Section title="Payments" className="mb-0">
                <PaymentsTable rows={payments.data?.items ?? []} />
              </Section>
            </>
          }
          rail={
            <div className="space-y-6">
              <Section title="Settlement" className="mb-0">
                <div className="space-y-3">
                  <SettlementCard
                    icon={<ClockIcon className="size-5" />}
                    tone="pending"
                    title="Pending settlement"
                    amount={summary.data?.pendingSettlement ?? 0}
                    blurb="Payment confirmed by the bank. The payout run has not sent it yet — usually the next working day."
                  />
                  <SettlementCard
                    icon={<BankIcon className="size-5" />}
                    tone="settled"
                    title="Settled to your bank"
                    amount={summary.data?.settled ?? 0}
                    blurb={
                      account
                        ? `Paid out to ${account.bankName} ••${account.accountLast4}. Nothing further to do.`
                        : "Add a settlement account so payouts have somewhere to land."
                    }
                  />
                </div>
                <Helper className="mt-2.5">
                  IronCore never holds your money as a balance. Each payment is
                  split at the gateway and paid out to your own account — there
                  is nothing to withdraw from inside the app.
                </Helper>
              </Section>

              <Section title="Where your money is" className="mb-0">
                <Card>
                  <SettlementBar
                    pending={summary.data?.pendingSettlement ?? 0}
                    settled={summary.data?.settled ?? 0}
                  />
                </Card>
              </Section>

              <Section title="Recent payouts" className="mb-0">
                <Card>
                  {settlements.data?.items.length ? (
                    settlements.data.items.map((row) => (
                      <ListItem
                        key={row.id}
                        title={naira(row.amount)}
                        meta={`${row.payments} payments · ${row.bankName} ••${row.accountLast4}`}
                        right={
                          <Pill tone={row.status === "paid" ? "valid" : "token"}>
                            {row.status === "paid" ? "Paid" : "Processing"}
                          </Pill>
                        }
                      />
                    ))
                  ) : (
                    <Helper>
                      Your first payout appears here once a payment has cleared.
                    </Helper>
                  )}
                </Card>
              </Section>
            </div>
          }
        />
      )}
    </Container>
  );
}

function SettlementCard({
  icon,
  tone,
  title,
  amount,
  blurb,
}: {
  icon: React.ReactNode;
  tone: "pending" | "settled";
  title: string;
  amount: number;
  blurb: string;
}) {
  return (
    <Card className={tone === "settled" ? "border-valid/40 bg-valid-dim" : ""}>
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            tone === "settled"
              ? "bg-white text-valid"
              : "bg-token-dim text-token-ink",
          )}
        >
          {icon}
        </span>
        <div>
          <p className="text-btn font-bold text-ink">{title}</p>
          <p className="font-mono text-lg font-bold text-ink">
            {naira(amount)}
          </p>
        </div>
      </div>
      <Helper className="mt-2.5 text-steel">{blurb}</Helper>
    </Card>
  );
}

function PaymentsTable({ rows }: { rows: OwnerPaymentRow[] }) {
  if (rows.length === 0) {
    return (
      <Card className="py-10 text-center">
        <p className="text-btn font-bold">No payments in this period</p>
        <Helper className="mt-1.5">
          Renewals and day passes appear here the moment they clear.
        </Helper>
      </Card>
    );
  }

  return (
    <>
      {/* Wide screens get the full grid; the table scrolls inside itself. */}
      <div className="hidden overflow-x-auto rounded-card border border-line bg-paper md:block">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {["Member", "Type", "You earned", "Status", "Date"].map(
                (heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="px-4 py-3 text-micro font-semibold tracking-[0.5px] text-steel-soft uppercase"
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-line-soft last:border-b-0"
              >
                <td className="px-4 py-3 text-sm font-semibold text-ink">
                  {row.member}
                </td>
                <td className="px-4 py-3 text-xs text-steel-soft">{row.kind}</td>
                <td className="px-4 py-3 font-mono text-sm font-bold text-ink">
                  {naira(row.amount)}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={row.status} />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-steel-soft">
                  {shortDate(row.date)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones read the same rows as a list. */}
      <Card className="md:hidden">
        {rows.map((row) => (
          <ListItem
            key={row.id}
            title={row.member}
            meta={`${row.kind} · ${shortDate(row.date)}`}
            right={
              <div className="text-right">
                <span className="block font-mono text-sm font-bold text-ink">
                  {naira(row.amount)}
                </span>
                <span className="mt-1 block">
                  <StatusPill status={row.status} />
                </span>
              </div>
            }
          />
        ))}
      </Card>
    </>
  );
}

function StatusPill({ status }: { status: "pending" | "settled" }) {
  return status === "settled" ? (
    <Pill tone="valid">Settled</Pill>
  ) : (
    <Pill tone="token">Pending</Pill>
  );
}

function shortDate(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

function PaymentsSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <StatGrid columns={4}>
        {[0, 1, 2, 3].map((key) => (
          <div
            key={key}
            className="h-[104px] rounded-card border border-line bg-paper"
          />
        ))}
      </StatGrid>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-[280px] rounded-card border border-line bg-paper" />
        <div className="space-y-3">
          <div className="h-[132px] rounded-card border border-line bg-paper" />
          <div className="h-[132px] rounded-card border border-line bg-paper" />
        </div>
      </div>
    </div>
  );
}
