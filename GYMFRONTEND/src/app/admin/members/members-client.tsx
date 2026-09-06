"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { CheckIcon, CrossIcon, MembersIcon } from "@/components/icons";
import {
  Container,
  Helper,
  PageHeader,
  Section,
  Split,
} from "@/components/layout/page";
import { GymLabel } from "@/components/admin/gym-label";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputField, SelectField } from "@/components/ui/field";
import { ListItem } from "@/components/ui/list-item";
import { Pill } from "@/components/ui/pill";
import { Stat, StatGrid } from "@/components/ui/stat";
import { messageOf } from "@/lib/api";
import { readMemberSheet } from "@/lib/csv";
import { daysLeftLabel } from "@/lib/format";
import {
  addMember as createMember,
  reissueCredentials,
  useMyGym,
  usePlans,
  useRoster,
  type MemberCredentials,
  type RosterRow,
} from "@/lib/domain";

const SAMPLE_SHEET = `name,phone,plan
Chidinma Okafor,08032147765,Monthly
Tunde Adisa,08064412210,Quarterly`;

type AddResult = MemberCredentials;

/**
 * Where the member signs in. Read from the browser rather than configured, so
 * the message carries whichever address the gym actually reached the app on.
 */
function signInUrl(): string {
  if (typeof window === "undefined") return "/sign-in";
  return `${window.location.origin}/sign-in`;
}

/**
 * The roster. Members normally arrive by paying for a plan; this screen is for
 * the ones a gym already had — a paper register being moved over, or someone
 * signed up at the desk.
 */
export function MembersClient() {
  const gym = useMyGym();
  const gymId = gym.data?.id;
  const plans = usePlans(gymId);

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const roster = useRoster(gymId, search);

  const [flash, setFlash] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<AddResult[]>([]);

  const rows = roster.data?.items ?? [];
  const active = rows.filter((row) => row.daysLeft > 0).length;

  async function addMember(input: {
    name: string;
    phone: string;
    planId: string;
  }): Promise<AddResult> {
    const result = await createMember(gymId!, input);
    roster.reload();
    return result;
  }

  /**
   * Hands the sign-in details over again for someone who never received them.
   * The old password is gone — only its hash was kept — so the API mints a new
   * one, and refuses outright once the member has signed in even once.
   */
  async function resendCredentials(row: RosterRow) {
    setProblem(null);
    try {
      const result = await reissueCredentials(gymId!, row.memberId);
      setFlash(`New password issued for ${result.name}`);
      setCredentials([result]);
      roster.reload();
    } catch (cause: unknown) {
      // The usual refusal is "they have already signed in", which is worth
      // reading in full rather than as a failed click.
      setProblem(messageOf(cause));
    }
  }

  return (
    <Container>
      <PageHeader
        label={<GymLabel />}
        title="Members"
        description="Everyone who trains here, and how long their cover has left."
      />

      <Split
        main={
          <>
            <Section className="mb-0">
              <StatGrid columns={3}>
                <Stat value={roster.data?.total ?? 0} label="On the roster" />
                <Stat value={active} label="Active cover" />
                <Stat
                  value={(roster.data?.total ?? 0) - active}
                  label="Lapsed"
                  hint="Worth a reminder"
                />
              </StatGrid>
            </Section>

            <Section title="Roster" className="mt-6 mb-0">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setSearch(query.trim());
                }}
              >
                <InputField
                  label="Search"
                  type="search"
                  placeholder="Name or phone number, then press enter"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </form>

              {roster.loading ? (
                <div className="h-64 animate-pulse rounded-card bg-paper" />
              ) : rows.length === 0 ? (
                <Card className="py-10 text-center">
                  <p className="text-btn font-bold">No members yet</p>
                  <Helper className="mt-1.5">
                    Add the ones you already have, or wait for the first plan to
                    be bought.
                  </Helper>
                </Card>
              ) : (
                <Card>
                  {rows.map((row) => (
                    <ListItem
                      key={row.id}
                      left={<Avatar name={row.name} tone="steel" />}
                      title={row.name}
                      meta={`${row.plan} · ${row.phone}`}
                      right={
                        <div className="flex items-center gap-2.5">
                          <ResendCredentials
                            row={row}
                            onResend={() => resendCredentials(row)}
                          />
                          <Pill
                            tone={
                              row.daysLeft === 0
                                ? "hazard"
                                : row.daysLeft <= 3
                                  ? "token"
                                  : "valid"
                            }
                          >
                            {daysLeftLabel(row.daysLeft)}
                          </Pill>
                        </div>
                      }
                    />
                  ))}
                </Card>
              )}
            </Section>
          </>
        }
        rail={
          <div className="space-y-6">
            {flash && (
              <Card className="border-valid/40 bg-valid-dim">
                <p className="flex items-center gap-2 text-btn font-bold">
                  <CheckIcon className="size-4 text-valid" />
                  {flash}
                </p>
              </Card>
            )}

            {problem && (
              <Card className="border-hazard/40 bg-hazard-dim">
                <p className="flex items-start gap-2 text-sm font-semibold">
                  <CrossIcon className="mt-0.5 size-4 shrink-0 text-hazard" />
                  {problem}
                </p>
              </Card>
            )}

            {credentials.length > 0 && (
              <CredentialsCard
                rows={credentials}
                onDismiss={() => setCredentials([])}
              />
            )}

            <AddMemberCard
              plans={plans.data?.items ?? []}
              disabled={!gymId}
              onAdd={async (input) => {
                const result = await addMember(input);
                setFlash(`${result.name} added`);
                setCredentials([result]);
              }}
            />

            <ImportCard
              plans={plans.data?.items ?? []}
              disabled={!gymId}
              onImport={async (rows) => {
                const created: AddResult[] = [];
                for (const row of rows) {
                  created.push(await addMember(row));
                }
                setFlash(`${created.length} members imported`);
                setCredentials(created);
              }}
            />
          </div>
        }
      />
    </Container>
  );
}

/* ------------------------------------------------------------------
   Handover
   ------------------------------------------------------------------ */

/**
 * The "send their details again" control on a roster row.
 *
 * It only appears while the member has never signed in. After that their
 * password is genuinely their own — the gym cannot see it and has no business
 * replacing it — so the row says so instead of offering a button.
 */
function ResendCredentials({
  row,
  onResend,
}: {
  row: RosterRow;
  onResend: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  if (row.hasLoggedIn) {
    return (
      <span
        title="They have signed in, so their password is their own"
        className="hidden text-2xs text-steel-soft sm:inline"
      >
        Signed in
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onResend();
        } finally {
          setBusy(false);
        }
      }}
      className="text-2xs font-bold tracking-[0.4px] text-hazard uppercase transition-opacity hover:opacity-70 disabled:opacity-50"
    >
      {busy ? "Issuing…" : "Resend login"}
    </button>
  );
}

/** The message the desk sends on. Written so it reads on its own in a chat. */
function handoverNote(row: AddResult): string {
  const lines = [
    `Hi ${row.name.split(" ")[0]}, your gym membership is set up.`,
    "",
    `Plan: ${row.plan}`,
    // The link first: a message that opens with an address is one tap to act on.
    `Sign in here: ${signInUrl()}`,
    `Phone number: ${row.phone}`,
  ];

  if (row.temporaryPassword) {
    lines.push(`Temporary password: ${row.temporaryPassword}`);
    lines.push("You will be asked to pick your own password when you sign in.");
  } else {
    lines.push("Use the password you already have on your account.");
  }

  lines.push("", `Check-in code: ${row.qrToken}`);
  return lines.join("\n");
}

/**
 * The one moment these details exist in readable form. The password is never
 * stored in the clear, so it cannot be looked up again — everything here is
 * built to be copied and sent before the card is dismissed.
 */
function CredentialsCard({
  rows,
  onDismiss,
}: {
  rows: AddResult[];
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const hasPasswords = rows.some((row) => row.temporaryPassword);

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // A blocked clipboard is not worth an error state: the details are on
      // screen and can still be read out or written down.
      setCopied(null);
    }
  }

  return (
    <Card className="border-token/50 bg-token-dim">
      <h2 className="font-display text-[19px] tracking-[0.3px]">
        {rows.length === 1 ? "Their sign-in details" : "Sign-in details"}
      </h2>
      <Helper className="mt-1 text-steel">
        {hasPasswords
          ? "Copy these and send them on now. The password is shown once and is never stored in readable form — dismiss this and it is gone."
          : "These numbers already had accounts, so they keep the password they set. Their check-in code is below."}
      </Helper>

      <div className="mt-3 space-y-3">
        {rows.map((row) => (
          <div
            key={row.phone}
            className="rounded-ctl border border-line bg-white p-3.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold">{row.name}</p>
                <p className="text-xs text-steel-soft">{row.plan}</p>
              </div>
              {!row.temporaryPassword && (
                <span className="shrink-0 rounded-full bg-chalk px-2.5 py-1 text-2xs font-bold tracking-[0.4px] text-steel uppercase">
                  Existing account
                </span>
              )}
            </div>

            <dl className="mt-3 space-y-2">
              <CredentialRow label="Phone (username)" value={row.phone} />
              <CredentialRow
                label="Temporary password"
                value={row.temporaryPassword ?? "Their existing password"}
                muted={!row.temporaryPassword}
              />
              <CredentialRow label="Check-in code" value={row.qrToken} />
            </dl>

            <Button
              type="button"
              variant="ghost"
              className="mt-3"
              onClick={() => void copy(row.phone, handoverNote(row))}
            >
              {copied === row.phone ? (
                <>
                  <CheckIcon className="size-4" />
                  Copied
                </>
              ) : (
                "Copy message to send"
              )}
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {rows.length > 1 && (
          <Button
            type="button"
            variant="dark"
            onClick={() =>
              void copy("all", rows.map(handoverNote).join("\n\n———\n\n"))
            }
          >
            {copied === "all" ? "Copied all" : "Copy all"}
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onDismiss}>
          Done
        </Button>
      </div>
    </Card>
  );
}

function CredentialRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-micro font-semibold tracking-[0.4px] text-steel-soft uppercase">
        {label}
      </dt>
      <dd
        className={
          muted
            ? "text-right text-xs text-steel-soft"
            : "text-right font-mono text-sm font-bold break-all text-ink"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function AddMemberCard({
  plans,
  disabled,
  onAdd,
}: {
  plans: { _id: string; name: string }[];
  disabled: boolean;
  onAdd: (input: {
    name: string;
    phone: string;
    planId: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [planId, setPlanId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (name.trim().length < 2) return setError("Enter the member's name");
    if (phone.replace(/\D/g, "").length < 10)
      return setError("Enter a valid phone number");
    if (!planId) return setError("Choose the plan they are on");

    setSaving(true);
    try {
      await onAdd({ name: name.trim(), phone, planId });
      setName("");
      setPhone("");
    } catch (cause: unknown) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="font-display text-[19px] tracking-[0.3px]">Add a member</h2>
      <Helper className="mt-1 mb-3">
        For someone you already have. No payment is taken and nothing lands in
        your payments report.
      </Helper>

      <form onSubmit={submit} noValidate>
        <InputField
          label="Full name"
          placeholder="Chidinma Okafor"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <InputField
          label="Phone number"
          type="tel"
          inputMode="tel"
          placeholder="080X XXX XXXX"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
        <SelectField
          label="Plan"
          value={planId}
          onChange={(event) => setPlanId(event.target.value)}
        >
          <option value="">Choose a plan</option>
          {plans.map((plan) => (
            <option key={plan._id} value={plan._id}>
              {plan.name}
            </option>
          ))}
        </SelectField>

        {error && (
          <p role="alert" className="mb-3 text-xs font-medium text-hazard">
            {error}
          </p>
        )}

        <Button type="submit" disabled={disabled || saving}>
          {saving ? "Adding…" : "Add member"}
        </Button>
      </form>
    </Card>
  );
}

function ImportCard({
  plans,
  disabled,
  onImport,
}: {
  plans: { _id: string; name: string }[];
  disabled: boolean;
  onImport: (
    rows: { name: string; phone: string; planId: string }[],
  ) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setBusy(true);

    try {
      const text = await file.text();
      const { rows } = readMemberSheet(text);

      // A plan name in the sheet is matched to a real plan; unmatched rows
      // fall back to the first plan rather than being dropped silently.
      const mapped = rows
        .filter((row) => !row.problem)
        .map((row) => {
          const plan =
            plans.find(
              (candidate) =>
                candidate.name.toLowerCase() === row.plan.toLowerCase(),
            ) ?? plans[0];
          return plan
            ? { name: row.name, phone: row.phone, planId: plan._id }
            : null;
        })
        .filter(
          (row): row is { name: string; phone: string; planId: string } =>
            row !== null,
        );

      if (mapped.length === 0) {
        setError("Nothing in that sheet could be imported");
        return;
      }

      await onImport(mapped);
    } catch (cause: unknown) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Card>
      <h2 className="font-display text-[19px] tracking-[0.3px]">
        Import a sheet
      </h2>
      <Helper className="mt-1 mb-3">
        A CSV with name, phone and plan columns. Rows without a matching plan use
        your first plan.
      </Helper>

      <pre className="mb-3 overflow-x-auto rounded-ctl bg-chalk p-3 font-mono text-[11px] leading-[1.6] text-steel">
        {SAMPLE_SHEET}
      </pre>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFile}
        className="sr-only"
        id="member-sheet"
      />
      <Button
        type="button"
        variant="ghost"
        disabled={disabled || busy}
        onClick={() => fileRef.current?.click()}
      >
        <MembersIcon className="size-4" />
        {busy ? "Importing…" : "Choose a CSV"}
      </Button>

      {error && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-1.5 text-xs font-medium text-hazard"
        >
          <CrossIcon className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </Card>
  );
}
