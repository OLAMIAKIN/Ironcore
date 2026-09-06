"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  MembersIcon,
  PackagesIcon,
  ScanIcon,
  UserIcon,
} from "@/components/icons";
import {
  Container,
  Helper,
  PageHeader,
  Section,
  Split,
} from "@/components/layout/page";
import { GymLabel, StaffAvatar } from "@/components/admin/gym-label";
import { ActionCard } from "@/components/ui/action-card";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListItem } from "@/components/ui/list-item";
import { Pill } from "@/components/ui/pill";
import { Stat, StatGrid } from "@/components/ui/stat";
import { naira } from "@/lib/format";
import { useMyGym, useOverview, useRecentCheckIns } from "@/lib/domain";

/**
 * Today at a glance. "Earned today" is the gym's own share of what was paid —
 * the API's owner endpoints never return the gross or the platform's cut.
 */
export function DashboardClient() {
  const gym = useMyGym();
  const gymId = gym.data?.id;
  const overview = useOverview(gymId);
  const checkIns = useRecentCheckIns(gymId);

  const entries = checkIns.data?.items ?? [];
  const denied = entries.filter((entry) => !entry.allowed).length;
  const expiring = overview.data?.expiring ?? [];

  const draft = gym.data?.status === "draft";

  return (
    <Container>
      <PageHeader
        label={<GymLabel />}
        title="Today"
        description="Live numbers from the front desk. Everything here updates as members scan in."
        right={<StaffAvatar />}
      />

      {draft && (
        <Card className="mb-6 border-token/50 bg-token-dim">
          <p className="text-btn font-bold text-ink">
            Your gym is not listed yet
          </p>
          <Helper className="mt-1.5 text-steel">
            Finish the listing payment and members will be able to find you and
            buy plans.
          </Helper>
        </Card>
      )}

      <Split
        main={
          <>
            <Section className="mb-0">
              <StatGrid columns={4}>
                <Stat
                  value={checkIns.data?.today ?? 0}
                  label="Check-ins today"
                />
                <Stat
                  value={overview.data?.today.payments ?? 0}
                  label="Payments today"
                />
                <Stat
                  value={naira(overview.data?.today.earned ?? 0)}
                  label="Earned today"
                  hint="Your share"
                />
                <Stat
                  value={overview.data?.activeMembers ?? 0}
                  label="Active members"
                />
              </StatGrid>
            </Section>

            <Section
              title="Expiring this week"
              className="mt-6"
              action={
                <Link
                  href="/admin/members"
                  className="inline-flex items-center gap-1.5 text-[13px] font-bold text-hazard"
                >
                  All members
                  <ArrowRightIcon className="size-4" />
                </Link>
              }
            >
              <Card>
                {expiring.length === 0 ? (
                  <Helper>
                    Nobody lapses this week. Reminders go out automatically 3
                    days before a plan ends.
                  </Helper>
                ) : (
                  expiring.map((member) => (
                    <ListItem
                      key={member.id}
                      left={<Avatar name={member.name} tone="steel" />}
                      title={member.name}
                      meta={`${member.plan} plan`}
                      right={
                        <Pill tone={member.daysLeft <= 3 ? "hazard" : "token"}>
                          {member.daysLeft} days
                        </Pill>
                      }
                    />
                  ))
                )}
              </Card>
            </Section>

            <Section title="Recent entries" className="mb-0">
              <Card>
                {entries.length === 0 ? (
                  <Helper>
                    No scans yet today. They appear here the moment the door
                    reads a code.
                  </Helper>
                ) : (
                  entries.map((entry) => (
                    <ListItem
                      key={entry.id}
                      title={entry.who}
                      meta={`${new Date(entry.at).toLocaleTimeString("en-NG", {
                        hour: "numeric",
                        minute: "2-digit",
                      })} · ${entry.kind}`}
                      right={
                        <Pill tone={entry.allowed ? "valid" : "hazard"}>
                          {entry.allowed ? "Allowed" : "Denied"}
                        </Pill>
                      }
                    />
                  ))
                )}
              </Card>
            </Section>
          </>
        }
        rail={
          <div className="space-y-6">
            <Card className="bg-ink text-white">
              <p className="text-micro font-semibold tracking-[1px] text-mist uppercase">
                You earned today
              </p>
              <p className="mt-1.5 font-display text-[42px] leading-none">
                {naira(overview.data?.today.earned ?? 0)}
              </p>
              <p className="mt-2 text-helper text-mist-dim">
                From {overview.data?.today.payments ?? 0} payments, settled to
                your bank.
              </p>
              <div className="mt-5">
                <ButtonLink href="/admin/payments" variant="primary">
                  See payments
                  <ArrowRightIcon className="size-4" />
                </ButtonLink>
              </div>
            </Card>

            {denied > 0 && (
              <Card className="border-hazard/40 bg-hazard-dim">
                <p className="text-btn font-bold text-ink">
                  {denied} {denied === 1 ? "entry was" : "entries were"} turned
                  away
                </p>
                <Helper className="mt-1.5 text-steel">
                  Expired plans and used day passes. Following up usually
                  recovers most of them the same week.
                </Helper>
              </Card>
            )}

            <Section title="Shortcuts" className="mb-0">
              <div className="space-y-3">
                <ActionCard
                  href="/admin/payments"
                  icon={PackagesIcon}
                  title="Payments & settlements"
                  description="What you earned and what has been paid out"
                />
                <ActionCard
                  href="/staff/scanner"
                  icon={ScanIcon}
                  title="Open door scanner"
                  description="Check a member in from the front desk"
                />
                <ActionCard
                  href="/admin/members"
                  icon={MembersIcon}
                  title="Add or import members"
                  description="One at a time, or upload a sheet"
                />
                <ActionCard
                  href="/admin/staff"
                  icon={UserIcon}
                  title="Staff & roles"
                  description="Give your team their own logins"
                />
              </div>
            </Section>
          </div>
        }
      />
    </Container>
  );
}
