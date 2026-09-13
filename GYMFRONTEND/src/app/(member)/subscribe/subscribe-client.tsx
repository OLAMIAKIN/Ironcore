"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckIcon } from "@/components/icons";
import {
  Container,
  Helper,
  PageHeader,
  Section,
  Split,
} from "@/components/layout/page";
import { CheckoutSheet } from "@/components/payments/checkout-sheet";
import { SplitNote } from "@/components/payments/split-note";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListItem } from "@/components/ui/list-item";
import { Pill } from "@/components/ui/pill";
import { SelectField } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { naira } from "@/lib/format";
import { useGyms, useMySubscriptions, usePlans, type Plan } from "@/lib/domain";
import { channelLabel, feesOf, type CheckoutSession } from "@/lib/payments";

/**
 * Joining and renewing, which are the same purchase from the member's side.
 * Any listed gym can be picked, whether or not they already train somewhere —
 * a membership is per gym, so moving across town means adding a second one
 * rather than giving up the first. The API prices it and the checkout only
 * ever displays what the API said it would charge.
 */

type Receipt = {
  planName: string;
  session: CheckoutSession;
  expires: string;
  /** False when this was their first plan at that gym — the wording differs. */
  renewal: boolean;
};

export function SubscribeClient() {
  const subscriptions = useMySubscriptions();
  const gyms = useGyms();

  const mine = subscriptions.data?.items ?? [];
  const [chosenGymId, setChosenGymId] = useState<string | null>(null);

  // "Find a gym" links here with the gym it was showing, so arriving from
  // discover lands on that gym rather than on whichever they joined first.
  const requestedGymId = useSearchParams().get("gym");

  // Defaults to the gym they already belong to, so nothing has to be synced
  // once the subscriptions arrive.
  const gymId =
    chosenGymId ??
    requestedGymId ??
    mine[0]?.gym.id ??
    gyms.data?.items[0]?.id ??
    null;

  const plans = usePlans(gymId ?? undefined);
  const [planId, setPlanId] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const current = mine.find((row) => row.gym.id === gymId);
  const options = plans.data?.items ?? [];
  const plan =
    options.find((candidate) => candidate._id === planId) ??
    options.find((candidate) => candidate.popular) ??
    options[0];

  // Every listed gym is on offer, not only the ones already joined — that is
  // what makes relocating possible without giving up an existing membership.
  const joined = mine.map((row) => ({
    id: row.gym.id,
    name: `${row.gym.name} — ${row.gym.branch}`,
  }));
  const others = (gyms.data?.items ?? [])
    .filter((gym) => !mine.some((row) => row.gym.id === gym.id))
    .map((gym) => ({ id: gym.id, name: `${gym.name} — ${gym.branch}` }));

  const gymChoices = [...joined, ...others];
  const listed = gyms.data?.items.find((gym) => gym.id === gymId);

  const gymName =
    current?.gym.name ??
    listed?.name ??
    gymChoices.find((row) => row.id === gymId)?.name ??
    "your gym";

  if (receipt) {
    return (
      <Container width="narrow">
        <div className="py-10 text-center lg:py-16">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-valid-dim text-valid">
            <CheckIcon className="size-8" />
          </div>
          <h1 className="mt-5 font-display text-[34px] leading-none tracking-[0.5px] sm:text-[42px]">
            {receipt.renewal ? "Subscription renewed" : "You are in"}
          </h1>
          <p className="mt-2.5 text-sm text-steel-soft">
            {naira(receipt.session.amount)} paid with{" "}
            {channelLabel(receipt.session.channel).toLowerCase()}.{" "}
            {receipt.renewal
              ? "Your membership is active again."
              : "Your check-in code for this gym is on your home screen."}
          </p>

          <Card className="mt-7 text-left">
            <ListItem
              title="Plan"
              right={
                <span className="text-sm font-semibold">
                  {receipt.planName}
                </span>
              }
            />
            <ListItem
              title="Amount paid"
              right={
                <span className="font-mono text-sm font-bold">
                  {naira(receipt.session.amount)}
                </span>
              }
            />
            {receipt.session.split && (
              <>
                <ListItem
                  title="Paid to the gym"
                  meta="Settled directly to them"
                  right={
                    <span className="font-mono text-sm font-bold">
                      {naira(receipt.session.split.gymNet)}
                    </span>
                  }
                />
                <ListItem
                  title="Card & platform charges"
                  meta="Added on top, so the gym is paid in full"
                  right={
                    <span className="font-mono text-sm text-steel-soft">
                      {naira(feesOf(receipt.session.split))}
                    </span>
                  }
                />
              </>
            )}
            <ListItem
              title="Covers you until"
              meta="Days left on your old plan were carried over"
              right={
                <span className="font-mono text-sm font-bold">
                  {receipt.expires}
                </span>
              }
            />
            <ListItem
              title="Reference"
              right={
                <span className="font-mono text-xs text-steel-soft">
                  {receipt.session.reference}
                </span>
              }
            />
          </Card>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <ButtonLink href="/home" variant="dark">
              Back to home
            </ButtonLink>
            <Button variant="ghost" onClick={() => setReceipt(null)}>
              Change plan
            </Button>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <PageHeader
        label={
          current
            ? `${current.gym.name} — ${current.gym.branch}`
            : listed
              ? `${listed.name} — ${listed.branch}`
              : "Membership"
        }
        title={current ? "Renew your subscription" : "Join this gym"}
        description={
          current
            ? "Pick the length that suits you. Longer plans work out cheaper per month and include more trainer sessions."
            : "Joining here does not touch a membership you already have — you keep both, each with its own check-in code."
        }
        right={
          current && (
            <Pill tone={current.daysLeft > 0 ? "valid" : "hazard"} dot>
              {current.daysLeft > 0
                ? `${current.daysLeft} days left`
                : "Expired"}
            </Pill>
          )
        }
      />

      <Split
        main={
          <Section title="Plans" className="mb-0">
            {plans.loading ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
                {[0, 1, 2].map((key) => (
                  <div
                    key={key}
                    className="h-52 animate-pulse rounded-card bg-paper"
                  />
                ))}
              </div>
            ) : options.length === 0 ? (
              <Card className="py-10 text-center">
                <p className="text-btn font-bold">
                  This gym has no plans on sale
                </p>
                <Helper className="mt-1.5">
                  Ask the front desk, or pick a different gym.
                </Helper>
              </Card>
            ) : (
              <fieldset className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <legend className="sr-only">Membership plan</legend>
                {options.map((candidate) => (
                  <PlanOption
                    key={candidate._id}
                    plan={candidate}
                    selected={candidate._id === plan?._id}
                    current={candidate.name === current?.plan.name}
                    onSelect={() => setPlanId(candidate._id)}
                  />
                ))}
              </fieldset>
            )}
          </Section>
        }
        rail={
          <Card>
            <h2 className="font-display text-[19px] tracking-[0.3px]">
              Order summary
            </h2>

            {gymChoices.length > 1 && (
              <div className="mt-3">
                <SelectField
                  label="Gym"
                  value={gymId ?? ""}
                  onChange={(event) => {
                    setChosenGymId(event.target.value);
                    setPlanId(null);
                  }}
                >
                  {joined.length > 0 && (
                    <optgroup label="Gyms you train at">
                      {joined.map((choice) => (
                        <option key={choice.id} value={choice.id}>
                          {choice.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {others.length > 0 && (
                    <optgroup
                      label={
                        joined.length > 0 ? "Join another gym" : "Partner gyms"
                      }
                    >
                      {others.map((choice) => (
                        <option key={choice.id} value={choice.id}>
                          {choice.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </SelectField>
              </div>
            )}

            <div className="mt-2">
              <ListItem
                title={plan ? `${plan.name} plan` : "Choose a plan"}
                meta={plan ? `${plan.durationDays} days` : undefined}
                right={
                  <span className="font-mono text-sm font-bold">
                    {plan ? naira(plan.price) : "—"}
                  </span>
                }
              />
              <ListItem
                title="Total"
                right={
                  <span className="font-mono text-lg font-bold">
                    {plan ? naira(plan.price) : "—"}
                  </span>
                }
              />
            </div>

            <Helper className="mt-3">
              {gymName} receives the full price above. Card and platform charges
              are added on top, and you will see the exact total before you pay.
            </Helper>

            <div className="mt-4">
              <Button
                onClick={() => setCheckoutOpen(true)}
                disabled={!plan || !gymId}
              >
                {plan
                  ? `${current ? "Renew" : "Join"} · ${naira(plan.price)} + fees`
                  : "Choose a plan"}
              </Button>
            </div>

            <Helper className="mt-2.5 text-center">
              You get a reminder 3 days before this plan expires.
            </Helper>
          </Card>
        }
      />

      {plan && gymId && (
        <CheckoutSheet
          open={checkoutOpen}
          title={gymName}
          context={`${plan.name} plan · ${plan.durationDays} days`}
          purchase={{
            purpose: "subscription",
            channel: "card",
            gymId,
            planId: plan._id,
          }}
          transparency={(session) =>
            session.split ? (
              <SplitNote
                gymName={gymName}
                gymNet={session.split.gymNet}
                platformFee={session.split.platformFee}
                gatewayFee={session.split.gatewayFee}
                bare
              />
            ) : null
          }
          onSuccess={(session) => {
            setReceipt({
              planName: plan.name,
              session,
              expires: coverUntil(current?.daysLeft ?? 0, plan.durationDays),
              renewal: Boolean(current),
            });
            void subscriptions.reload();
          }}
          onClose={() => setCheckoutOpen(false)}
          successTitle={current ? "Subscription renewed" : "You are in"}
          successBody={(session) => (
            <>
              {gymName} has been paid{" "}
              {session.split ? naira(session.split.gymNet) : "their share"}{" "}
              directly. Your membership runs until{" "}
              {coverUntil(current?.daysLeft ?? 0, plan.durationDays)}.
            </>
          )}
          continueLabel="See your receipt"
          onContinue={() => setCheckoutOpen(false)}
        />
      )}
    </Container>
  );
}

/** A renewal stacks on the days already left; it does not replace them. */
function coverUntil(daysLeft: number, durationDays: number): string {
  const end = new Date();
  end.setDate(end.getDate() + daysLeft + durationDays);
  return end.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function PlanOption({
  plan,
  selected,
  current,
  onSelect,
}: {
  plan: Plan;
  selected: boolean;
  /** The plan they are already on — worth calling out while renewing. */
  current: boolean;
  onSelect: () => void;
}) {
  const perMonth = Math.round(plan.price / (plan.durationDays / 30));

  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col rounded-card bg-paper p-[18px] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink lg:p-5",
        selected
          ? "border-2 border-ink"
          : "border border-line hover:border-line-strong",
      )}
    >
      <input
        type="radio"
        name="plan"
        value={plan._id}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />

      <div className="flex items-start justify-between gap-2">
        <span className="text-[15px] font-bold">{plan.name}</span>
        {current ? (
          <Pill tone="valid">Your plan</Pill>
        ) : plan.popular ? (
          <Pill tone="token">Popular</Pill>
        ) : (
          selected && (
            <span className="flex size-5 items-center justify-center rounded-full bg-ink text-white">
              <CheckIcon className="size-3" />
            </span>
          )
        )}
      </div>

      <div className="mt-1.5 font-mono text-[26px] font-bold">
        {naira(plan.price)}
      </div>

      {plan.perks && <Helper className="mt-2">{plan.perks}</Helper>}

      <p className="mt-3 text-micro font-semibold tracking-[0.4px] text-steel-soft uppercase">
        {naira(perMonth)} per month
      </p>
    </label>
  );
}
