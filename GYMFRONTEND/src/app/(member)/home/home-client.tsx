"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  ClockIcon,
  MapPinIcon,
  PackagesIcon,
  TicketIcon,
} from "@/components/icons";
import {
  Container,
  Helper,
  PageHeader,
  Section,
  Split,
} from "@/components/layout/page";
import { Greeting } from "@/components/member/greeting";
import { GymSwitcher } from "@/components/member/gym-switcher";
import { MembershipCard } from "@/components/member/membership-card";
import { MemberName } from "@/components/member/member-name";
import { ActionCard } from "@/components/ui/action-card";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Stat, StatGrid } from "@/components/ui/stat";
import { ListItem } from "@/components/ui/list-item";
import { daysLeftLabel, naira } from "@/lib/format";
import { useMySubscriptions } from "@/lib/domain";
import { useSession } from "@/lib/session";
import { useStoredValue } from "@/lib/use-stored-value";

/** Remembers the gym whose code was last on screen, per browser. */
const ACTIVE_GYM_KEY = "ironcore.activeGym";

/** The member's own screen: their code, their cover, and what to do next. */
export function HomeClient() {
  const { user } = useSession();
  const { data, loading, error, reload } = useMySubscriptions();

  const memberships = data?.items ?? [];

  // Which membership is on screen. Someone who has relocated keeps both gyms,
  // and the one they want is usually the one they picked last.
  const [chosenId, chooseGym] = useStoredValue(ACTIVE_GYM_KEY);

  // A remembered id can point at a membership that is no longer there, so it
  // is resolved against the list rather than trusted on its own.
  const primary =
    memberships.find((row) => row.id === chosenId) ?? memberships[0];

  return (
    <Container>
      <PageHeader
        label={<Greeting />}
        title={<MemberName />}
        right={user && <Avatar name={user.name} className="size-11" />}
      />

      {loading && <HomeSkeleton />}

      {!loading && error && (
        <Card className="border-hazard/40 bg-hazard-dim">
          <p className="text-btn font-bold">{error}</p>
          <Helper className="mt-1.5 text-steel">
            The API may not be running. Start it with `npm run dev` in
            GYMBACKEND.
          </Helper>
        </Card>
      )}

      {!loading && !error && !primary && <NoMembership />}

      {!loading && primary && (
        <Split
          main={
            <>
              <GymSwitcher
                memberships={memberships}
                activeId={primary.id}
                onSelect={chooseGym}
              />

              <MembershipCard
                membership={primary}
                onChanged={() => reload()}
              />

              <Section title="Your cover" className="mt-6 lg:mt-8">
                <StatGrid columns={4}>
                  <Stat
                    value={primary.daysLeft}
                    label="Days left"
                    hint={primary.autoRenew ? "Renews automatically" : "Auto-renew off"}
                  />
                  <Stat
                    value={primary.plan.name}
                    label="Plan"
                    hint={naira(primary.plan.price)}
                  />
                  <Stat
                    value={memberships.length}
                    label="Gyms"
                    hint={
                      memberships.length > 1
                        ? "Switch above to change code"
                        : "On this account"
                    }
                  />
                  <Stat
                    value={primary.status === "active" ? "Open" : "Locked"}
                    label="Door access"
                    hint={primary.status === "active" ? "Code is live" : "Renew to unlock"}
                  />
                </StatGrid>
              </Section>

              <Section title="Quick actions">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <ActionCard
                    href={`/subscribe?gym=${primary.gym.id}`}
                    icon={PackagesIcon}
                    title="Renew subscription"
                    description={`${primary.gym.name} · from ${naira(primary.plan.price)}`}
                  />
                  <ActionCard
                    href="/discover"
                    icon={MapPinIcon}
                    title="Join another gym"
                    description="Moved? Keep this one and add the new one"
                  />
                  <ActionCard
                    href="/guest-pass"
                    icon={TicketIcon}
                    title="Buy a day pass"
                    description="Single entry, valid until midnight"
                  />
                </div>
              </Section>
            </>
          }
          rail={
            <div className="space-y-6">
              <Section title="Membership" className="mb-0">
                <Card>
                  <ListItem
                    title="Expires"
                    meta={
                      primary.autoRenew
                        ? "Renews automatically unless cancelled"
                        : "Auto-renew is off"
                    }
                    right={
                      <span className="font-mono text-sm font-bold text-ink">
                        {daysLeftLabel(primary.daysLeft)}
                      </span>
                    }
                  />
                  <ListItem
                    title="Home gym"
                    meta={primary.gym.area}
                    right={<Pill tone="valid">Open</Pill>}
                  />
                  <ListItem
                    title="Plan"
                    meta={`${primary.plan.durationDays} days`}
                    right={
                      <span className="font-mono text-sm font-bold text-ink">
                        {naira(primary.plan.price)}
                      </span>
                    }
                  />
                </Card>
              </Section>

              <Card className="bg-ink text-white">
                <div className="flex items-center gap-2 text-micro font-semibold tracking-[1px] text-mist uppercase">
                  <ClockIcon className="size-4" />
                  At the door
                </div>
                <p className="mt-2 text-sm leading-[1.55] text-mist">
                  Show the code on your card. The front desk scans it and the
                  gate opens — no paper, no card.
                </p>
                <Link
                  href="/discover"
                  className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-hazard"
                >
                  See all branches
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Card>
            </div>
          }
        />
      )}
    </Container>
  );
}

function NoMembership() {
  return (
    <Card className="py-12 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-chalk text-steel-soft">
        <PackagesIcon />
      </span>
      <p className="mt-3 text-btn font-bold">You have no membership yet</p>
      <Helper className="mx-auto mt-1.5 max-w-sm">
        Pick a gym and a plan, and your check-in code appears here straight
        after payment.
      </Helper>
      <div className="mx-auto mt-5 max-w-xs">
        <ButtonLink href="/subscribe">Choose a plan</ButtonLink>
      </div>
    </Card>
  );
}

function HomeSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="h-64 rounded-card bg-ink/10" />
      <StatGrid columns={4}>
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-[104px] rounded-card bg-paper" />
        ))}
      </StatGrid>
    </div>
  );
}
