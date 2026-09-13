"use client";

import { useState } from "react";
import { CheckIcon, ClockIcon, TicketIcon } from "@/components/icons";
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
import { Card, DarkCard } from "@/components/ui/card";
import { SelectField } from "@/components/ui/field";
import { ListItem } from "@/components/ui/list-item";
import { QrCode } from "@/components/ui/qr-code";
import { naira } from "@/lib/format";
import {
  isPassLive,
  useGyms,
  useMyDayPasses,
  type DayPass,
} from "@/lib/domain";

/**
 * A day pass is a payment like any other: the API prices it from the gym's own
 * day-pass price, and issues the token only once that payment has cleared.
 *
 * The token lives on the server, not in this component's state, so it is still
 * here after a refresh, on a second device, or when the phone is reopened at
 * the door hours later. It goes away on its own when it is scanned or when the
 * day ends.
 */

export function GuestPassClient({
  initialGymId,
}: {
  initialGymId: string | null;
}) {
  const { data, loading } = useGyms();
  const gyms = data?.items ?? [];

  const passes = useMyDayPasses();
  // Only unused passes that are still inside their day are worth showing.
  const live = (passes.data?.items ?? []).filter(isPassLive);

  const [chosenId, setChosenId] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // The dropdown falls back to the link's gym, then to the first listed one,
  // so there is nothing to synchronise once the list arrives.
  const gym =
    gyms.find((candidate) => candidate.id === chosenId) ??
    gyms.find((candidate) => candidate.id === initialGymId) ??
    gyms[0] ??
    null;
  const gymId = gym?.id ?? null;
  const setGymId = setChosenId;

  return (
    <Container>
      <PageHeader
        label="Day pass"
        title={gym ? gym.name : "Day pass"}
        description="One entry, valid until closing time today. No membership, no sign-up."
      />

      <Split
        main={
          <>
            <Section
              title={live.length > 0 ? "Your passes today" : "After payment"}
              className="mb-0"
            >
              {passes.loading ? (
                <div
                  className="h-72 animate-pulse rounded-card bg-ink/10"
                  aria-hidden
                />
              ) : live.length > 0 ? (
                <div className="space-y-4">
                  {live.map((pass) => (
                    <PassCard key={pass.id} pass={pass} />
                  ))}
                </div>
              ) : (
                <Card className="flex flex-col items-center py-9 text-center">
                  <span className="flex size-12 items-center justify-center rounded-full bg-chalk text-steel-soft">
                    <TicketIcon />
                  </span>
                  <p className="mt-3 text-sm font-semibold">
                    Your token appears here
                  </p>
                  <Helper className="mt-1.5 max-w-xs">
                    Pay and the gym issues a one-time code. It stays on this
                    screen until you use it or the day ends.
                  </Helper>
                </Card>
              )}
            </Section>

            <Section title="What you get" className="mt-6 mb-0">
              <Card>
                <ListItem
                  title="Access"
                  right={
                    <span className="text-[13.5px]">Today, single entry</span>
                  }
                />
                <ListItem
                  title="Gym"
                  meta={gym ? gym.area : undefined}
                  right={
                    <span className="text-[13.5px] font-semibold">
                      {gym?.branch ?? "—"}
                    </span>
                  }
                />
                <ListItem
                  title="Valid until"
                  right={
                    <span className="font-mono text-[13.5px]">11:59 PM</span>
                  }
                />
                <ListItem
                  title="Price"
                  right={
                    <span className="font-mono text-sm font-bold">
                      {gym ? naira(gym.dayPassPrice) : "—"}
                    </span>
                  }
                />
              </Card>
            </Section>
          </>
        }
        rail={
          <div className="space-y-6">
            {live.length > 0 && (
              <Card className="border-valid/40 bg-valid-dim">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/70 text-valid">
                    <CheckIcon className="size-5" />
                  </span>
                  <div>
                    <p className="text-btn font-bold">
                      {live.length === 1
                        ? "Pass ready"
                        : `${live.length} passes ready`}
                    </p>
                    <p className="text-xs text-steel">
                      Show the code at the door. You can close this page.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/*
              Checkout stays available even while a pass is live: someone buying
              for a friend, or for a second gym on the same day, should not have
              to use up today's pass first.
            */}
            <Card>
              <h2 className="font-display text-[19px] tracking-[0.3px]">
                {live.length > 0 ? "Buy another pass" : "Checkout"}
              </h2>

              <div className="mt-3">
                <SelectField
                  label="Gym"
                  value={gymId ?? ""}
                  onChange={(event) => setGymId(event.target.value)}
                >
                  <option value="">
                    {loading ? "Loading gyms…" : "Choose a gym"}
                  </option>
                  {gyms.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} — {naira(option.dayPassPrice)}
                    </option>
                  ))}
                </SelectField>
              </div>

              <Button
                variant="token"
                onClick={() => setCheckoutOpen(true)}
                disabled={!gym}
              >
                {gym
                  ? `Buy a pass · ${naira(gym.dayPassPrice)} + fees`
                  : "Choose a gym"}
              </Button>

              <Helper className="mt-2.5 text-center">
                The gym receives its full price; card and platform charges are
                added on top. You will see the exact total before you pay.
              </Helper>

              <Helper className="mt-2.5 text-center">
                Single entry. Passes are not refundable once issued.
              </Helper>

              <Helper className="mt-4 text-center">
                Coming often? A monthly plan pays for itself after 8 visits.
              </Helper>
              <ButtonLink
                href="/subscribe"
                variant="ghost"
                className="mt-2.5 border-none text-hazard"
              >
                See membership plans
              </ButtonLink>
            </Card>
          </div>
        }
      />

      {gym && (
        <CheckoutSheet
          open={checkoutOpen}
          title={gym.name}
          context="Day pass · valid until 11:59 PM today"
          purchase={{ purpose: "day_pass", channel: "card", gymId: gym.id }}
          transparency={(session) =>
            session.split ? (
              <SplitNote
                gymName={gym.name}
                gymNet={session.split.gymNet}
                platformFee={session.split.platformFee}
                gatewayFee={session.split.gatewayFee}
                bare
              />
            ) : null
          }
          onSuccess={() => passes.reload()}
          onClose={() => setCheckoutOpen(false)}
          successTitle="Pass issued"
          successBody={() => (
            <>
              Your one-time code is ready. Show it at {gym.name} any time before
              closing today.
            </>
          )}
          continueLabel="See my token"
          onContinue={() => setCheckoutOpen(false)}
        />
      )}
    </Container>
  );
}

/** One live pass: the code to scan, and how long it has left. */
function PassCard({ pass }: { pass: DayPass }) {
  return (
    <DarkCard className="text-center">
      <p className="text-micro font-semibold tracking-[1px] text-mist uppercase">
        {pass.gym.name} — {pass.gym.branch}
      </p>
      <QrCode
        value={pass.token}
        label={`Guest token for ${pass.gym.name}`}
        className="mt-3.5 size-[170px] lg:size-[190px]"
      />
      <p className="mt-3 font-mono text-[15px] tracking-[2px] text-white">
        {pass.token}
      </p>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-micro text-mist-dim">
        <ClockIcon className="size-3.5" />
        Expires{" "}
        {new Date(pass.validUntil).toLocaleTimeString("en-NG", {
          hour: "numeric",
          minute: "2-digit",
        })}{" "}
        today
      </p>
    </DarkCard>
  );
}
