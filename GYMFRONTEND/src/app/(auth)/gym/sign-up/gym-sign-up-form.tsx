"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRightIcon, BankIcon, CheckIcon } from "@/components/icons";
import { AuthHeading } from "@/components/layout/auth-layout";
import { Helper } from "@/components/layout/page";
import { CheckoutSheet } from "@/components/payments/checkout-sheet";
import { SandboxBadge } from "@/components/payments/sandbox-badge";
import { Button } from "@/components/ui/button";
import { CheckboxField, InputField, SelectField } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { messageOf } from "@/lib/api";
import { cn } from "@/lib/cn";
import { naira } from "@/lib/format";
import {
  resolveAccount,
  saveSettlementAccount,
  useBanks,
  useListingPlans,
  type ListingPlan,
} from "@/lib/domain";
import { signUpGym } from "@/lib/session";

/**
 * Four steps, in the order the money needs them:
 *   1. the gym, 2. the owner's login, 3. where payments settle, 4. going live.
 *
 * The account in step 3 is the whole point of step 4: a gym cannot be paid by
 * its members until it has told us where its share should land.
 */

type Fields = {
  gymName: string;
  branch: string;
  area: string;
  dayPassPrice: string;
  ownerName: string;
  ownerPhone: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
};

type Errors = Partial<Record<keyof Fields, string>>;

type Step = 1 | 2 | 3 | 4;

const EMPTY: Fields = {
  gymName: "",
  branch: "",
  area: "",
  dayPassPrice: "2000",
  ownerName: "",
  ownerPhone: "",
  password: "",
  confirmPassword: "",
  terms: false,
};

function validateGym(fields: Fields): Errors {
  const errors: Errors = {};
  if (fields.gymName.trim().length < 2) errors.gymName = "Enter the gym name";
  if (fields.branch.trim().length < 2)
    errors.branch = "Which branch is this? e.g. Lekki";
  if (fields.area.trim().length < 2)
    errors.area = "Enter the area or neighbourhood";

  const price = Number(fields.dayPassPrice);
  if (!price) errors.dayPassPrice = "Set a day pass price";
  else if (price < 100 || price > 200000)
    errors.dayPassPrice = "Day passes must be between ₦100 and ₦200,000";

  return errors;
}

function validateOwner(fields: Fields): Errors {
  const errors: Errors = {};

  if (fields.ownerName.trim().length < 2)
    errors.ownerName = "Enter your full name";
  else if (!fields.ownerName.trim().includes(" "))
    errors.ownerName = "Enter your first and last name";

  const digits = fields.ownerPhone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 14)
    errors.ownerPhone = "Enter a valid phone number";

  if (fields.password.length < 8) errors.password = "Use at least 8 characters";
  if (fields.confirmPassword !== fields.password)
    errors.confirmPassword = "Passwords do not match";

  if (!fields.terms) errors.terms = "Accept the partner terms to continue";

  return errors;
}

export function GymSignUpForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** Set by step 2 — everything after it is a signed-in owner. */
  const [gymId, setGymId] = useState<string | null>(null);
  const [accountSaved, setAccountSaved] = useState(false);

  const listingPlans = useListingPlans();
  const [planId, setPlanId] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const plans = listingPlans.data?.items ?? [];
  const plan =
    plans.find((candidate) => candidate.id === planId) ??
    plans.find((candidate) => candidate.recommended) ??
    plans[0];

  const gymLabel = fields.gymName.trim() || "your gym";

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
    setErrors((current) =>
      current[key] ? { ...current, [key]: undefined } : current,
    );
  }

  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateGym(fields);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    setStep(2);
  }

  /** Step 2 creates the owner and the gym; the gym stays a draft until paid. */
  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailed(null);

    const found = validateOwner(fields);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setSubmitting(true);
    try {
      const result = await signUpGym({
        ownerName: fields.ownerName.trim(),
        phone: fields.ownerPhone,
        password: fields.password,
        gymName: fields.gymName.trim(),
        branch: fields.branch.trim(),
        area: fields.area.trim(),
        dayPassPrice: Number(fields.dayPassPrice),
      });
      setGymId(result.gymId);
      setStep(3);
    } catch (error: unknown) {
      setFailed(messageOf(error));
    } finally {
      setSubmitting(false);
    }
  }

  const HEADINGS: Record<Step, { title: string; subtitle: string }> = {
    1: {
      title: "Register your gym",
      subtitle:
        "Put your gym on IronCore. Members find you, buy passes and scan in at the door.",
    },
    2: {
      title: "Your owner account",
      subtitle: `You will sign in with this to run ${gymLabel}.`,
    },
    3: {
      title: "Where should we pay you?",
      subtitle:
        "Every member payment is split at the gateway and your share is sent straight to this account.",
    },
    4: {
      title: "Pick your listing plan",
      subtitle: `Last step. ${gymLabel} goes live the moment this payment clears.`,
    },
  };

  return (
    <>
      <AuthHeading
        title={HEADINGS[step].title}
        subtitle={HEADINGS[step].subtitle}
      />

      <StepDots step={step} />

      {step === 1 && (
        <form onSubmit={next} noValidate>
          <InputField
            label="Gym name"
            placeholder="IronCore Gym"
            value={fields.gymName}
            error={errors.gymName}
            onChange={(event) => set("gymName", event.target.value)}
          />
          <div className="grid gap-x-3.5 sm:grid-cols-2">
            <InputField
              label="Branch"
              placeholder="Lekki"
              value={fields.branch}
              error={errors.branch}
              onChange={(event) => set("branch", event.target.value)}
            />
            <InputField
              label="Area"
              placeholder="Lekki Phase 1"
              value={fields.area}
              error={errors.area}
              onChange={(event) => set("area", event.target.value)}
            />
          </div>
          <InputField
            label="Day pass price (₦)"
            inputMode="numeric"
            placeholder="2000"
            value={fields.dayPassPrice}
            error={errors.dayPassPrice}
            onChange={(event) =>
              set("dayPassPrice", event.target.value.replace(/\D/g, ""))
            }
          />
          <Helper className="-mt-1.5 mb-4">
            Walk-ins will pay{" "}
            {fields.dayPassPrice ? naira(Number(fields.dayPassPrice)) : "—"} per
            entry. You can change this later.
          </Helper>

          <Button type="submit">
            Continue
            <ArrowRightIcon className="size-4" />
          </Button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={createAccount} noValidate>
          <InputField
            label="Your full name"
            autoComplete="name"
            placeholder="Ada Danjuma"
            value={fields.ownerName}
            error={errors.ownerName}
            onChange={(event) => set("ownerName", event.target.value)}
          />
          <InputField
            label="Phone number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="080X XXX XXXX"
            value={fields.ownerPhone}
            error={errors.ownerPhone}
            onChange={(event) => set("ownerPhone", event.target.value)}
          />
          <div className="grid gap-x-3.5 sm:grid-cols-2">
            <InputField
              label="Password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={fields.password}
              error={errors.password}
              onChange={(event) => set("password", event.target.value)}
            />
            <InputField
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={fields.confirmPassword}
              error={errors.confirmPassword}
              onChange={(event) => set("confirmPassword", event.target.value)}
            />
          </div>

          <CheckboxField
            label={
              <>
                I run this gym and accept the{" "}
                <span className="font-semibold text-ink">partner terms</span>.
              </>
            }
            checked={fields.terms}
            error={errors.terms}
            onChange={(event) => set("terms", event.target.checked)}
          />

          {failed && (
            <p role="alert" className="mb-3.5 text-xs font-medium text-hazard">
              {failed}
            </p>
          )}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating your account…" : "Continue"}
            {!submitting && <ArrowRightIcon className="size-4" />}
          </Button>

          <button
            type="button"
            onClick={() => setStep(1)}
            className="mt-4 w-full text-center text-[13px] font-semibold text-steel-soft hover:text-ink"
          >
            Back to gym details
          </button>
        </form>
      )}

      {step === 3 && gymId && (
        <SettlementStep
          gymId={gymId}
          onDone={() => {
            setAccountSaved(true);
            setStep(4);
          }}
        />
      )}

      {step === 4 && (
        <div>
          <div className="mb-4 flex items-center justify-center gap-2 lg:justify-start">
            <SandboxBadge />
            {accountSaved && <Pill tone="valid">Bank account saved</Pill>}
          </div>

          {listingPlans.loading && (
            <div className="space-y-3" aria-hidden>
              <div className="h-40 animate-pulse rounded-card bg-paper" />
              <div className="h-40 animate-pulse rounded-card bg-paper" />
            </div>
          )}

          <fieldset className="grid gap-3">
            <legend className="sr-only">Listing plan</legend>
            {plans.map((candidate) => (
              <PlanTier
                key={candidate.id}
                plan={candidate}
                selected={candidate.id === plan?.id}
                onSelect={() => setPlanId(candidate.id)}
              />
            ))}
          </fieldset>

          {plan && (
            <div className="mt-4">
              <Button onClick={() => setCheckoutOpen(true)}>
                Pay {naira(plan.price)} and go live
                <ArrowRightIcon className="size-4" />
              </Button>
            </div>
          )}

          <Helper className="mt-2.5 text-center">
            {gymLabel} is created but not listed yet. It goes live the moment
            this payment clears.
          </Helper>
        </div>
      )}

      <p className="mt-6 text-center text-[13px] text-steel-soft">
        Already registered?{" "}
        <Link
          href="/gym/sign-in"
          className="font-bold text-ink underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>

      {plan && (
        <CheckoutSheet
          open={checkoutOpen}
          title="IronCore listing"
          context={`${plan.name} plan · ${naira(plan.price)}${plan.period} · ${gymLabel}`}
          purchase={{
            purpose: "listing",
            channel: "card",
            listingPlanId: plan.id,
          }}
          transparency={() => (
            <>
              <span className="font-semibold text-ink">What this covers.</span>{" "}
              {naira(plan.price)} per month keeps {gymLabel} listed on IronCore.
              Member payments are separate — those are split at the gateway and
              your share is settled to the account you just added.
            </>
          )}
          onSuccess={() => undefined}
          onClose={() => setCheckoutOpen(false)}
          successTitle="You are live"
          successBody={() => (
            <>
              {gymLabel} is on IronCore and your {plan.name} plan is active.
              Members can find you and buy passes right away.
            </>
          )}
          continueLabel="Go to your dashboard"
          onContinue={() => router.push("/admin/dashboard")}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------
   Step 3 — the settlement account
   ------------------------------------------------------------------ */

function SettlementStep({
  gymId,
  onDone,
}: {
  gymId: string;
  onDone: () => void;
}) {
  const banks = useBanks();
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = bankCode !== "" && accountNumber.length === 10;

  /** Name lookup first: nobody should save an account they cannot recognise. */
  async function check() {
    setChecking(true);
    setError(null);
    setAccountName(null);
    try {
      const result = await resolveAccount(bankCode, accountNumber);
      setAccountName(result.accountName);
    } catch (cause: unknown) {
      setError(messageOf(cause));
    } finally {
      setChecking(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accountName) {
      await check();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveSettlementAccount(gymId, bankCode, accountNumber);
      onDone();
    } catch (cause: unknown) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <SelectField
        label="Bank"
        value={bankCode}
        onChange={(event) => {
          setBankCode(event.target.value);
          setAccountName(null);
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
          setAccountNumber(event.target.value.replace(/\D/g, "").slice(0, 10));
          setAccountName(null);
        }}
        className="font-mono tracking-[1px]"
      />

      {accountName ? (
        <div className="mb-4 flex items-center gap-2.5 rounded-ctl border border-valid/40 bg-valid-dim p-3.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-valid">
            <CheckIcon className="size-4" />
          </span>
          <div>
            <p className="text-[13px] font-bold text-ink">{accountName}</p>
            <p className="text-xs text-steel">
              Confirm this is the account your gym is paid into.
            </p>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          onClick={check}
          disabled={!ready || checking}
          className="mb-4"
        >
          <BankIcon className="size-4" />
          {checking ? "Checking the account…" : "Check account name"}
        </Button>
      )}

      {error && (
        <p role="alert" className="mb-3.5 text-xs font-medium text-hazard">
          {error}
        </p>
      )}

      <Button type="submit" disabled={!ready || saving}>
        {saving
          ? "Saving…"
          : accountName
            ? "Use this account"
            : "Check account name"}
      </Button>

      <Helper className="mt-2.5 text-center">
        We store the account for payouts only. Your members never see it, and
        IronCore never holds your money — each payment is split at the gateway.
      </Helper>
    </form>
  );
}

/* ------------------------------------------------------------------
   Pieces
   ------------------------------------------------------------------ */

function PlanTier({
  plan,
  selected,
  onSelect,
}: {
  plan: ListingPlan;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col rounded-card bg-paper p-[18px] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
        selected
          ? "border-2 border-ink"
          : "border border-line hover:border-line-strong",
      )}
    >
      <input
        type="radio"
        name="listing-plan"
        value={plan.id}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />

      <div className="flex items-start justify-between gap-2">
        <span className="text-[15px] font-bold">{plan.name}</span>
        {plan.recommended ? (
          <Pill tone="token">Recommended</Pill>
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
        <span className="font-body text-xs text-steel-soft">{plan.period}</span>
      </div>

      <Helper className="mt-2">{plan.tagline}</Helper>

      <ul className="mt-3 space-y-1.5">
        {plan.perks.map((perk) => (
          <li
            key={perk}
            className="flex items-start gap-2 text-[13px] text-steel"
          >
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-valid" />
            {perk}
          </li>
        ))}
      </ul>
    </label>
  );
}

function StepDots({ step }: { step: Step }) {
  const labels = ["Gym", "Owner", "Payouts", "Go live"];
  return (
    <ol className="mb-6 flex items-center gap-2.5">
      {labels.map((label, index) => {
        const position = index + 1;
        const done = position <= step;
        return (
          <li key={label} className="flex flex-1 flex-col gap-1.5">
            <span
              className={done ? "hazard-tape" : "h-[5px] rounded-sm bg-line"}
            />
            <span
              className={`text-2xs font-semibold tracking-[1px] uppercase ${
                done ? "text-ink" : "text-steel-soft"
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
