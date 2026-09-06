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
import { api } from "@/lib/api";
import { naira } from "@/lib/format";
import { useGyms } from "@/lib/domain";

/**
 * A day pass is a payment like any other: the API prices it from the gym's own
 * day-pass price, and issues the token only once that payment has cleared.
 */

type IssuedPass = { token: string; validUntil: string };

export function GuestPassClient({
  initialGymId,
}: {
  initialGymId: string | null;
}) {
  const { data, loading } = useGyms();
  const gyms = data?.items ?? [];

  const [chosenId, setChosenId] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pass, setPass] = useState<IssuedPass | null>(null);

  // The dropdown falls back to the link's gym, then to the first listed one,
  // so there is nothing to synchronise once the list arrives.
  const gym =
    gyms.find((candidate) => candidate.id === chosenId) ??
    gyms.find((candidate) => candidate.id === initialGymId) ??
    gyms[0] ??
    null;
  const gymId = gym?.id ?? null;
  const setGymId = setChosenId;

  /** The token is minted server-side, so it is read back after payment. */
  async function loadIssuedPass() {
    const result = await api.get<{ items: IssuedPass[] }>("/me/day-passes");
    if (result.items[0]) setPass(result.items[0]);
  }

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
            <Section title="What you get" className="mb-0">
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
                  right={<span className="font-mono text-[13.5px]">11:59 PM</span>}
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

            <Section
              title={pass ? "Your token" : "After payment"}
              className="mt-6 mb-0"
            >
              {pass ? (
                <DarkCard className="text-center">
                  <p className="text-micro font-semibold tracking-[1px] text-mist uppercase">
                    Your guest token
                  </p>
                  <QrCode
                    value={pass.token}
                    label={`Guest token for ${gym?.name ?? "this gym"}`}
                    className="mt-3.5 size-[170px] lg:size-[190px]"
                  />
                  <p className="mt-3 font-mono text-[15px] tracking-[3px] text-white">
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
              ) : (
                <Card className="flex flex-col items-center py-9 text-center">
                  <span className="flex size-12 items-center justify-center rounded-full bg-chalk text-steel-soft">
                    <TicketIcon />
                  </span>
                  <p className="mt-3 text-sm font-semibold">
                    Your token appears here
                  </p>
                  <Helper className="mt-1.5 max-w-xs">
                    Pay and the gym issues a one-time code. Show it at the front
                    desk or hold it up to the scanner.
                  </Helper>
                </Card>
              )}
            </Section>
          </>
        }
        rail={
          <Card>
            {pass ? (
              <>
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-full bg-valid-dim text-valid">
                    <CheckIcon className="size-5" />
                  </span>
                  <div>
                    <p className="text-btn font-bold">Pass issued</p>
                    <p className="text-xs text-steel-soft">
                      {gym ? `${naira(gym.dayPassPrice)} paid · ${gym.name}` : ""}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-2.5">
                  <Button variant="ghost" onClick={() => setPass(null)}>
                    Buy another pass
                  </Button>
                </div>

                <Helper className="mt-3 text-center">
                  Coming often? A monthly plan pays for itself after 8 visits.
                </Helper>
                <ButtonLink
                  href="/subscribe"
                  variant="ghost"
                  className="mt-2.5 border-none text-hazard"
                >
                  See membership plans
                </ButtonLink>
              </>
            ) : (
              <>
                <h2 className="font-display text-[19px] tracking-[0.3px]">
                  Checkout
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
                    ? `Pay ${naira(gym.dayPassPrice)} & get token`
                    : "Choose a gym"}
                </Button>

                <Helper className="mt-2.5 text-center">
                  Single entry. Passes are not refundable once issued.
                </Helper>
              </>
            )}
          </Card>
        }
      />

      {gym && (
        <CheckoutSheet
          open={checkoutOpen}
          title={gym.name}
          context={`Day pass · valid until 11:59 PM today`}
          purchase={{ purpose: "day_pass", channel: "card", gymId: gym.id }}
          transparency={(session) =>
            session.split ? (
              <SplitNote
                gymName={gym.name}
                gymNet={session.split.gymNet}
                platformFee={session.split.platformFee}
                bare
              />
            ) : null
          }
          onSuccess={() => void loadIssuedPass()}
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
