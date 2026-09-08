"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ArrowRightIcon, MapPinIcon } from "@/components/icons";
import {
  Container,
  Helper,
  PageHeader,
  Section,
  Split,
} from "@/components/layout/page";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputField } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/cn";
import { naira } from "@/lib/format";
import { useGyms, useMySubscriptions, type Gym } from "@/lib/domain";
import { usePosition } from "@/lib/use-position";

/** Leaflet reaches for `window` as it loads, so it never runs on the server. */
const GymMap = dynamic(
  () => import("@/components/map/gym-map").then((mod) => mod.GymMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[160px] animate-pulse rounded-card bg-paper sm:h-[220px] lg:h-[280px]" />
    ),
  },
);

export function DiscoverClient() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Nothing is asked of the browser until the member presses "Near me". With a
  // position the API orders by real distance; without one it stays alphabetical.
  const here = usePosition();

  // The API does the filtering, so the list stays correct as gyms are added.
  const { data, loading } = useGyms(search, here.position);
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
            {results.length} {results.length === 1 ? "gym" : "gyms"}
            {here.position ? " nearby" : " listed"}
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

            <MapPanel
              gyms={results}
              selectedId={selected?.id ?? null}
              here={here}
            />

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
                {selected.distanceKm !== undefined && (
                  <Row label="Distance" value={distanceLabel(selected.distanceKm)} />
                )}
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

/** Metres under a kilometre; one decimal above it. Nobody needs more. */
function distanceLabel(km: number): string {
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m away`;
  return `${km.toFixed(1)} km away`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-helper text-steel-soft">{label}</dt>
      <dd className="font-mono text-sm font-bold">{value}</dd>
    </div>
  );
}

/**
 * The map, and the button that gives it a "you". Gyms whose owner has not
 * placed a pin have no coordinates and simply are not on it — the list below
 * still carries them.
 */
function MapPanel({
  gyms,
  selectedId,
  here,
}: {
  gyms: Gym[];
  selectedId: string | null;
  here: ReturnType<typeof usePosition>;
}) {
  const pins = gyms
    .filter((gym) => gym.lat !== undefined && gym.lng !== undefined)
    .map((gym) => ({
      id: gym.id,
      lat: gym.lat!,
      lng: gym.lng!,
      label: `${gym.name} — ${gym.branch}`,
      active: gym.id === selectedId,
    }));

  return (
    <div className="space-y-2.5">
      <GymMap
        pins={pins}
        you={here.position}
        className="h-[220px] sm:h-[280px] lg:h-[340px]"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          fullWidth={false}
          className="w-auto px-4"
          onClick={here.position ? here.clear : here.locate}
          disabled={here.state === "locating"}
        >
          <MapPinIcon className="size-4" />
          {here.state === "locating"
            ? "Finding you…"
            : here.position
              ? "Show all gyms"
              : "Gyms near me"}
        </Button>

        {here.message ? (
          <p role="status" className="text-helper text-hazard">
            {here.message}
          </p>
        ) : (
          <Helper>
            {here.position
              ? "Sorted by how far each gym is from you."
              : "Only gyms that have been placed on the map appear here."}
          </Helper>
        )}
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
        {gym.distanceKm !== undefined && (
          <>
            {" · "}
            <span className="font-semibold text-ink">
              {distanceLabel(gym.distanceKm)}
            </span>
          </>
        )}
      </p>
      <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-ink">
        {selected ? "Showing details" : "View gym"}
        <ArrowRightIcon className="size-4" />
      </span>
    </button>
  );
}
