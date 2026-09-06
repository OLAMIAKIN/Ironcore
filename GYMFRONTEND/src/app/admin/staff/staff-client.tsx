"use client";

import { useState, type FormEvent } from "react";
import { CheckIcon } from "@/components/icons";
import {
  Container,
  Helper,
  PageHeader,
  Section,
  Split,
} from "@/components/layout/page";
import { GymLabel } from "@/components/admin/gym-label";
import { STAFF_NAV } from "@/components/nav/nav-config";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputField } from "@/components/ui/field";
import { ListItem } from "@/components/ui/list-item";
import { Pill, type PillTone } from "@/components/ui/pill";
import { messageOf } from "@/lib/api";
import { cn } from "@/lib/cn";
import { addStaff, useMyGym, useStaff } from "@/lib/domain";
import { ROLE_LABELS } from "@/lib/session";

type StaffRole = "owner" | "manager" | "scanner";

const ROLE_TONE: Record<StaffRole, PillTone> = {
  owner: "hazard",
  manager: "token",
  scanner: "valid",
};

const ROLE_BLURBS: Record<StaffRole, string> = {
  owner: "Full access — billing, staff, packages and reports.",
  manager: "Members and check-ins. Cannot change staff or pricing.",
  scanner: "Door scanner only. Sees nothing else in the app.",
};

/** Who can do what. Roles are enforced by the API, not just hidden in the nav. */
export function StaffClient() {
  const gym = useMyGym();
  const gymId = gym.data?.id;
  const staff = useStaff(gymId);

  const [created, setCreated] = useState<string | null>(null);

  return (
    <Container>
      <PageHeader
        label={<GymLabel />}
        title="Staff & roles"
        description="Give your team their own logins. Each role only reaches the screens it needs."
      />

      <Split
        main={
          <>
            <Section title="Your team" className="mb-0">
              {staff.loading ? (
                <div className="h-48 animate-pulse rounded-card bg-paper" />
              ) : (
                <Card>
                  {(staff.data?.items ?? []).map((row) => (
                    <ListItem
                      key={row.id}
                      left={<Avatar name={row.name} tone="steel" />}
                      title={row.name}
                      meta={row.phone}
                      right={
                        <Pill tone={ROLE_TONE[row.role]}>
                          {ROLE_LABELS[row.role]}
                        </Pill>
                      }
                    />
                  ))}
                </Card>
              )}
            </Section>

            <Section title="What each role sees" className="mt-6 mb-0">
              <div className="grid gap-3 sm:grid-cols-3">
                {(["owner", "manager", "scanner"] as const).map((role) => (
                  <div
                    key={role}
                    className={cn(
                      "rounded-card border border-line bg-paper p-4",
                      role === "owner" && "border-ink",
                    )}
                  >
                    <Pill tone={ROLE_TONE[role]}>{ROLE_LABELS[role]}</Pill>
                    <Helper className="mt-2.5">{ROLE_BLURBS[role]}</Helper>
                    <ul className="mt-3 space-y-1">
                      {STAFF_NAV[role].map((item) => (
                        <li
                          key={item.href}
                          className="flex items-center gap-1.5 text-xs text-steel"
                        >
                          <CheckIcon className="size-3.5 text-valid" />
                          {item.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>
          </>
        }
        rail={
          <div className="space-y-6">
            {created && (
              <Card className="border-valid/40 bg-valid-dim">
                <p className="text-btn font-bold">{created} can now sign in</p>
                <Helper className="mt-1.5 text-steel">
                  They use their phone number and the password you set, at the
                  gym sign-in screen.
                </Helper>
              </Card>
            )}

            <AddStaffCard
              disabled={!gymId}
              onAdd={async (input) => {
                await addStaff(gymId!, input);
                staff.reload();
                setCreated(input.name);
              }}
            />
          </div>
        }
      />
    </Container>
  );
}

function AddStaffCard({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (input: {
    name: string;
    phone: string;
    role: "manager" | "scanner";
    password: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"manager" | "scanner">("scanner");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (name.trim().length < 2) return setError("Enter their full name");
    if (phone.replace(/\D/g, "").length < 10)
      return setError("Enter a valid phone number");
    if (password.length < 8)
      return setError("Set a password of at least 8 characters");

    setSaving(true);
    try {
      await onAdd({ name: name.trim(), phone, role, password });
      setName("");
      setPhone("");
      setPassword("");
    } catch (cause: unknown) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="font-display text-[19px] tracking-[0.3px]">
        Add a team member
      </h2>
      <Helper className="mt-1 mb-3">
        Set them a password now and change it with them at the desk.
      </Helper>

      <form onSubmit={submit} noValidate>
        <InputField
          label="Full name"
          placeholder="Ngozi Eze"
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

        <fieldset className="mb-3.5">
          <legend className="mb-1.5 block text-xs font-semibold text-steel">
            Role
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {(["manager", "scanner"] as const).map((option) => (
              <label
                key={option}
                className={cn(
                  "cursor-pointer rounded-ctl border px-3 py-2.5 text-center text-[13px] font-semibold transition-colors",
                  role === option
                    ? "border-ink bg-ink text-white"
                    : "border-line-strong bg-white text-steel hover:border-ink",
                )}
              >
                <input
                  type="radio"
                  name="role"
                  value={option}
                  checked={role === option}
                  onChange={() => setRole(option)}
                  className="sr-only"
                />
                {ROLE_LABELS[option]}
              </label>
            ))}
          </div>
        </fieldset>

        <InputField
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {error && (
          <p role="alert" className="mb-3 text-xs font-medium text-hazard">
            {error}
          </p>
        )}

        <Button type="submit" disabled={disabled || saving}>
          {saving ? "Creating…" : "Create login"}
        </Button>
      </form>
    </Card>
  );
}
