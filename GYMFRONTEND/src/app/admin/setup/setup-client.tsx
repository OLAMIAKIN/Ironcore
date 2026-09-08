"use client";

import { useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { BankIcon, CheckIcon, MapPinIcon } from "@/components/icons";
import {
  Container,
  Helper,
  PageHeader,
  Section,
  Split,
} from "@/components/layout/page";
import { GymLabel } from "@/components/admin/gym-label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputField, SelectField } from "@/components/ui/field";
import { ListItem } from "@/components/ui/list-item";
import { Pill } from "@/components/ui/pill";
import { messageOf } from "@/lib/api";
import { naira } from "@/lib/format";
import { usePosition } from "@/lib/use-position";

/** Leaflet reaches for `window` as it loads, so it never runs on the server. */
const GymMap = dynamic(
  () => import("@/components/map/gym-map").then((mod) => mod.GymMap),
  {
    ssr: false,
    loading: () => <div className="h-[200px] animate-pulse rounded-card bg-chalk" />,
  },
);
import {
  createPlan,
  geocodeAddress,
  resolveAccount,
  retirePlan,
  saveSettlementAccount,
  updateGym,
  useBanks,
  useMyGym,
  usePlans,
  type GeocodeHit,
} from "@/lib/domain";

/** Pricing, plans and the account the gym's share is settled to. */
export function SetupClient() {
  const gym = useMyGym();
  const gymId = gym.data?.id;
  const plans = usePlans(gymId);

  return (
    <Container>
      <PageHeader
        label={<GymLabel />}
        title="Setup"
        description="What you sell, what it costs, and where your money lands."
      />

      <Split
        main={
          <>
            <Section title="Membership plans" className="mb-0">
              {plans.loading ? (
                <div className="h-48 animate-pulse rounded-card bg-paper" />
              ) : (
                <Card>
                  {(plans.data?.items ?? []).map((plan) => (
                    <ListItem
                      key={plan._id}
                      title={plan.name}
                      meta={`${plan.durationDays} days${plan.perks ? ` · ${plan.perks}` : ""}`}
                      right={
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-bold">
                            {naira(plan.price)}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              await retirePlan(gymId!, plan._id);
                              plans.reload();
                            }}
                            className="text-xs font-semibold text-steel-soft hover:text-hazard"
                          >
                            Retire
                          </button>
                        </div>
                      }
                    />
                  ))}
                  {(plans.data?.items ?? []).length === 0 && (
                    <Helper>
                      No plans on sale. Add one below so members have something
                      to buy.
                    </Helper>
                  )}
                </Card>
              )}
              <Helper className="mt-2.5">
                Retiring a plan hides it from members. Anyone already on it keeps
                the cover they paid for.
              </Helper>
            </Section>

            <Section title="Add a plan" className="mt-6 mb-0">
              <AddPlanCard
                disabled={!gymId}
                onAdd={async (input) => {
                  await createPlan(gymId!, input);
                  plans.reload();
                }}
              />
            </Section>
          </>
        }
        rail={
          <div className="space-y-6">
            <DayPassCard
              gymId={gymId}
              price={gym.data?.dayPassPrice}
              onSaved={() => gym.reload()}
            />
            <LocationCard
              gymId={gymId}
              lat={gym.data?.lat}
              lng={gym.data?.lng}
              onSaved={() => gym.reload()}
            />
            <SettlementCard
              gymId={gymId}
              account={gym.data?.settlementAccount}
              onSaved={() => gym.reload()}
            />
          </div>
        }
      />
    </Container>
  );
}

function AddPlanCard({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (input: {
    name: string;
    price: number;
    durationDays: number;
    perks?: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [durationDays, setDurationDays] = useState("30");
  const [perks, setPerks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (name.trim().length < 2) return setError("Name the plan");
    if (Number(price) < 500) return setError("Plans start at ₦500");
    if (Number(durationDays) < 1) return setError("Set how long it runs");

    setSaving(true);
    try {
      await onAdd({
        name: name.trim(),
        price: Number(price),
        durationDays: Number(durationDays),
        perks: perks.trim() || undefined,
      });
      setName("");
      setPrice("");
      setPerks("");
    } catch (cause: unknown) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} noValidate>
        <div className="grid gap-x-3.5 sm:grid-cols-2">
          <InputField
            label="Plan name"
            placeholder="Monthly"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <InputField
            label="Price (₦)"
            inputMode="numeric"
            placeholder="15000"
            value={price}
            onChange={(event) =>
              setPrice(event.target.value.replace(/\D/g, ""))
            }
          />
        </div>
        <div className="grid gap-x-3.5 sm:grid-cols-2">
          <InputField
            label="Length (days)"
            inputMode="numeric"
            placeholder="30"
            value={durationDays}
            onChange={(event) =>
              setDurationDays(event.target.value.replace(/\D/g, ""))
            }
          />
          <InputField
            label="What is included"
            placeholder="Full access + 2 trainer sessions"
            value={perks}
            onChange={(event) => setPerks(event.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="mb-3 text-xs font-medium text-hazard">
            {error}
          </p>
        )}

        <Button type="submit" disabled={disabled || saving}>
          {saving ? "Adding…" : "Add plan"}
        </Button>
      </form>
    </Card>
  );
}

function DayPassCard({
  gymId,
  price,
  onSaved,
}: {
  gymId: string | undefined;
  price: number | undefined;
  onSaved: () => void;
}) {
  // Null until the owner types: the saved price shows through until then.
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = draft ?? (price === undefined ? "" : String(price));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const next = Number(value);
    if (next < 100 || next > 200000) {
      setError("Day passes run between ₦100 and ₦200,000");
      return;
    }

    try {
      await updateGym(gymId!, { dayPassPrice: next });
      setSaved(true);
      onSaved();
    } catch (cause: unknown) {
      setError(messageOf(cause));
    }
  }

  return (
    <Card>
      <h2 className="font-display text-[19px] tracking-[0.3px]">Day pass</h2>
      <Helper className="mt-1 mb-3">
        What a walk-in pays for a single entry.
      </Helper>

      <form onSubmit={submit} noValidate>
        <InputField
          label="Price (₦)"
          inputMode="numeric"
          value={value}
          error={error ?? undefined}
          onChange={(event) => {
            setDraft(event.target.value.replace(/\D/g, ""));
            setSaved(false);
          }}
        />
        <Button type="submit" disabled={!gymId}>
          {saved ? "Saved" : "Save price"}
        </Button>
      </form>
    </Card>
  );
}

/**
 * The account every payout goes to. Changing it only affects future payouts —
 * settlements already sent keep the account they were sent to.
 */
function SettlementCard({
  gymId,
  account,
  onSaved,
}: {
  gymId: string | undefined;
  account:
    | {
        bankName: string;
        accountName: string;
        accountLast4: string;
        needsReconnect: boolean;
      }
    | undefined;
  onSaved: () => void;
}) {
  const banks = useBanks();
  const [editing, setEditing] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolved, setResolved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    setError(null);
    try {
      const result = await resolveAccount(bankCode, accountNumber);
      setResolved(result.accountName);
    } catch (cause: unknown) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await saveSettlementAccount(gymId!, bankCode, accountNumber);
      setEditing(false);
      setResolved(null);
      setAccountNumber("");
      onSaved();
    } catch (cause: unknown) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-[19px] tracking-[0.3px]">
          Settlement account
        </h2>
        {account && (
          <Pill tone={account.needsReconnect ? "hazard" : "valid"}>
            {account.needsReconnect ? "Reconnect" : "Verified"}
          </Pill>
        )}
      </div>

      {account && !editing ? (
        <>
          <div className="mt-3 flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-full bg-chalk text-steel">
              <BankIcon className="size-5" />
            </span>
            <div>
              <p className="text-btn font-bold">{account.accountName}</p>
              <p className="font-mono text-xs text-steel-soft">
                {account.bankName} ••{account.accountLast4}
              </p>
            </div>
          </div>
          {account.needsReconnect ? (
            /*
             * The payout handles were issued by a different payment gateway —
             * usually the sandbox one, before real keys were added. They mean
             * nothing to the gateway now in use, which rejects every payment
             * outright, so this has to be fixed before the gym can take money.
             */
            <p className="mt-3 rounded-ctl border border-hazard/40 bg-hazard-dim px-3.5 py-3 text-helper leading-[1.5] font-semibold text-ink">
              This account was set up with a different payment provider, so
              payments to your gym will be declined. Add it again to reconnect
              it — the bank details are the same.
            </p>
          ) : (
            <Helper className="mt-3">
              Your share of every member payment is settled here. IronCore never
              holds it in between.
            </Helper>
          )}
          <Button
            variant={account.needsReconnect ? "primary" : "ghost"}
            className="mt-3"
            onClick={() => setEditing(true)}
          >
            {account.needsReconnect ? "Reconnect account" : "Change account"}
          </Button>
        </>
      ) : (
        <div className="mt-3">
          <SelectField
            label="Bank"
            value={bankCode}
            onChange={(event) => {
              setBankCode(event.target.value);
              setResolved(null);
            }}
          >
            <option value="">
              {banks.loading ? "Loading banks…" : "Choose your bank"}
            </option>
            {banks.data?.items.map((bank) => (
              <option key={bank.code} value={bank.code}>
                {bank.name}
              </option>
            ))}
          </SelectField>

          <InputField
            label="Account number"
            inputMode="numeric"
            placeholder="0123456789"
            value={accountNumber}
            onChange={(event) => {
              setAccountNumber(
                event.target.value.replace(/\D/g, "").slice(0, 10),
              );
              setResolved(null);
            }}
            className="font-mono"
          />

          {resolved && (
            <div className="mb-3 flex items-center gap-2 rounded-ctl border border-valid/40 bg-valid-dim p-3">
              <CheckIcon className="size-4 text-valid" />
              <span className="text-[13px] font-bold">{resolved}</span>
            </div>
          )}

          {error && (
            <p role="alert" className="mb-3 text-xs font-medium text-hazard">
              {error}
            </p>
          )}

          <Button
            onClick={resolved ? save : check}
            disabled={busy || bankCode === "" || accountNumber.length !== 10}
          >
            {busy
              ? "Working…"
              : resolved
                ? "Use this account"
                : "Check account name"}
          </Button>

          {account && (
            <Button
              variant="ghost"
              className="mt-2.5"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * Where the gym is. Until this is set the gym is missing from "gyms near me"
 * entirely — it has no position, so no honest distance can be shown for it.
 *
 * Two ways in, because gyms are set up both ways: an owner standing in their
 * own reception presses the button, and one doing paperwork at home drops the
 * pin by hand.
 */
function LocationCard({
  gymId,
  lat,
  lng,
  onSaved,
}: {
  gymId: string | undefined;
  lat?: number;
  lng?: number;
  onSaved: () => void;
}) {
  const here = usePosition();
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Address search: the usual way in, since an owner doing paperwork at home is
  // nowhere near the gym they are describing.
  const [address, setAddress] = useState("");
  const [hits, setHits] = useState<GeocodeHit[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function lookUp() {
    if (address.trim().length < 3) return;
    setSearching(true);
    setError(null);
    try {
      const { items } = await geocodeAddress(address.trim());
      setHits(items);
    } catch (cause: unknown) {
      setError(messageOf(cause));
    } finally {
      setSearching(false);
    }
  }

  // What the map shows: an unsaved pin first, then whatever is stored, then a
  // fix from the browser if the owner just asked for one.
  const pin =
    draft ??
    (lat !== undefined && lng !== undefined ? { lat, lng } : null) ??
    here.position;

  const dirty =
    pin !== null && (pin.lat !== lat || pin.lng !== lng);

  async function save() {
    if (!pin) return;
    setSaving(true);
    setError(null);
    try {
      await updateGym(gymId!, { lat: pin.lat, lng: pin.lng });
      setDraft(null);
      onSaved();
    } catch (cause: unknown) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-[19px] tracking-[0.3px]">
          Map location
        </h2>
        {lat !== undefined ? (
          <Pill tone="valid">On the map</Pill>
        ) : (
          <Pill tone="token">Not set</Pill>
        )}
      </div>

      <Helper className="mt-1 mb-3">
        {lat !== undefined
          ? "Members see this pin, and how far they are from it."
          : "Until you set this, your gym is missing from “gyms near me”."}
      </Helper>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void lookUp();
        }}
      >
        <InputField
          label="Search an address"
          placeholder="Street, area or landmark"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
        />
        <Button type="submit" variant="ghost" disabled={searching}>
          {searching ? "Looking up…" : "Find on the map"}
        </Button>
      </form>

      {hits !== null && (
        <div className="mt-3">
          {hits.length === 0 ? (
            <Helper>
              Nothing matched that. Try a nearby landmark or main street, or tap
              the map below.
            </Helper>
          ) : (
            <ul className="divide-y divide-line-soft">
              {hits.map((hit) => (
                <li key={`${hit.lat},${hit.lng}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft({ lat: hit.lat, lng: hit.lng });
                      setHits(null);
                    }}
                    className="w-full py-2.5 text-left text-helper text-steel hover:text-ink"
                  >
                    {hit.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-3">
        <GymMap
          pins={
            pin
              ? [
                  {
                    id: "gym",
                    lat: pin.lat,
                    lng: pin.lng,
                    label: "Your gym",
                    active: true,
                  },
                ]
              : []
          }
          onPick={(at) => setDraft(at)}
          className="h-[200px]"
        />
      </div>

      <Helper className="mt-2">
        Tap the map to nudge the pin exactly where the door is.
      </Helper>

      <div className="mt-3 space-y-2.5">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setDraft(null);
            here.locate();
          }}
          disabled={here.state === "locating"}
        >
          <MapPinIcon className="size-4" />
          {here.state === "locating"
            ? "Finding you…"
            : "I am at the gym now"}
        </Button>

        {dirty && (
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save this spot"}
          </Button>
        )}
      </div>

      {here.message && (
        <p role="status" className="mt-2.5 text-xs font-medium text-hazard">
          {here.message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2.5 text-xs font-medium text-hazard">
          {error}
        </p>
      )}
    </Card>
  );
}
