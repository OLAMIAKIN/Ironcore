"use client";

import { useState } from "react";
import { ArrowRightIcon, MapPinIcon } from "@/components/icons";
import {
  Container,
  Helper,
  PageHeader,
  Section,
  Split,
} from "@/components/layout/page";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputField } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/cn";
import { naira } from "@/lib/format";
import { useGyms, useMySubscriptions, type Gym } from "@/lib/domain";

export function DiscoverClient() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The API does the filtering, so the list stays correct as gyms are added.
  const { data, loading } = useGyms(search);
  const results = data?.items ?? [];

  // A member can hold a membership at any number of gyms, so "join" and
  // "renew" are decided per gym rather than by whether they have one at all.
  const mine = useMySubscriptions();
  const joinedIds = new Set(
    (mine.data?.items ?? []).map((row) => row.gym.id),
  );

  // Keep the rail on a gym that is still in the list.
  const selected =
    results.find((gym) => gym.id === selectedId) ?? results[0] ?? null;

  return (
    <Container>
      <PageHeader
        label="Partner gyms"
        title="Find a gym"
        description="Partner gyms you can walk into today. Buy a day pass on the spot — no membership required."
        right={
          <Pill tone="token">
            {results.length} {results.length === 1 ? "gym" : "gyms"} nearby
          </Pill>
        }
      />

      <Split
        main={
          <>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setSearch(query.trim());
              }}
            >
              <InputField
                label="Search"
                type="search"
                placeholder="Search by name or area, then press enter"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </form>

            <MapPanel gym={selected} />

            <Section title="Nearby" className="mt-6 mb-0">
              {loading ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
                  {[0, 1, 2].map((key) => (
                    <div
                      key={key}
                      className="h-32 animate-pulse rounded-card bg-paper"
                    />
                  ))}
                </div>
              ) : results.length === 0 ? (
                <Card className="text-center">
                  <p className="text-sm font-semibold">
                    No gyms match &ldquo;{search || query}&rdquo;
                  </p>
                  <Helper className="mt-1.5">
                    Try an area or a branch name — or clear the search to see
                    every listed gym.
                  </Helper>
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {results.map((gym) => (
                    <GymCard
                      key={gym.id}
                      gym={gym}
                      selected={gym.id === selected?.id}
                      onSelect={() => setSelectedId(gym.id)}
                    />
                  ))}
                </div>
              )}
            </Section>
          </>
        }
        rail={
          selected && (
            <Card>
              <p className="text-micro font-semibold tracking-[1px] text-steel-soft uppercase">
                Selected gym
              </p>
              <h2 className="mt-1 font-display text-[26px] leading-none tracking-[0.3px]">
                {selected.name}
              </h2>
              <p className="mt-1.5 flex items-center gap-1.5 text-helper text-steel-soft">
                <MapPinIcon className="size-4" />
                {selected.area} · {selected.branch}
              </p>

              <dl className="mt-4 space-y-3 border-t border-line-soft pt-4">
                <Row label="Day pass" value={`${naira(selected.dayPassPrice)}/day`} />
                <Row label="Opens" value="5:00 AM" />
                <Row label="Closes" value="10:00 PM" />
              </dl>

              <div className="mt-5 space-y-2.5">
                <ButtonLink href={`/guest-pass?gym=${selected.id}`} variant="token">
                  Buy a day pass
                </ButtonLink>
                <ButtonLink
                  href={`/subscribe?gym=${selected.id}`}
                  variant="ghost"
                >
                  {joinedIds.has(selected.id)
                    ? "Renew here"
                    : "Join this gym"}
                </ButtonLink>
              </div>
            </Card>
          )
        }
      />
    </Container>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-helper text-steel-soft">{label}</dt>
      <dd className="font-mono text-sm font-bold">{value}</dd>
    </div>
  );
}

/** Stand-in for the map. It reacts to the selection so the page feels live. */
function MapPanel({ gym }: { gym: Gym | null }) {
  return (
    <div className="relative h-[160px] overflow-hidden rounded-card border border-line bg-linear-to-br from-ink-soft to-ink sm:h-[220px] lg:h-[280px]">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-hazard text-white shadow-[0_6px_20px_rgba(255,90,54,0.45)]">
          <MapPinIcon />
        </span>
        <p className="font-mono text-micro tracking-[1px] text-mist uppercase">
          {gym ? `${gym.name} — ${gym.branch}` : "Map view"}
        </p>
      </div>
    </div>
  );
}

function GymCard({
  gym,
  selected,
  onSelect,
}: {
  gym: Gym;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "rounded-card bg-paper p-[18px] text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink lg:p-5",
        selected
          ? "border-2 border-ink"
          : "border border-line hover:border-line-strong",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-btn font-bold">{gym.name}</span>
        <Pill tone="token">{naira(gym.dayPassPrice)}/day</Pill>
      </div>
      <p className="mt-1 text-xs text-steel-soft">
        {gym.branch} · {gym.area}
      </p>
      <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-ink">
        {selected ? "Showing details" : "View gym"}
        <ArrowRightIcon className="size-4" />
      </span>
    </button>
  );
}
