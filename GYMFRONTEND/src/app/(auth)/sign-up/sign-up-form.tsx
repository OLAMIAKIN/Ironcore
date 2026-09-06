"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthHeading } from "@/components/layout/auth-layout";
import { Helper } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { CheckboxField, InputField } from "@/components/ui/field";
import { messageOf } from "@/lib/api";
import { signUpMember } from "@/lib/session";

type Fields = {
  name: string;
  phone: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
};

type Errors = Partial<Record<keyof Fields, string>>;

const EMPTY: Fields = {
  name: "",
  phone: "",
  password: "",
  confirmPassword: "",
  terms: false,
};

/** Mirrors the API's own rules, so a valid form is never rejected server-side. */
function validate(fields: Fields): Errors {
  const errors: Errors = {};

  if (fields.name.trim().length < 2) {
    errors.name = "Tell us what to call you";
  } else if (!fields.name.trim().includes(" ")) {
    errors.name = "Enter your first and last name";
  }

  const digits = fields.phone.replace(/\D/g, "");
  if (digits.length === 0) errors.phone = "Enter your phone number";
  else if (digits.length < 10 || digits.length > 14) {
    errors.phone = "That does not look like a valid phone number";
  }

  if (fields.password.length < 8) {
    errors.password = "Use at least 8 characters";
  }
  if (fields.confirmPassword !== fields.password) {
    errors.confirmPassword = "Passwords do not match";
  }

  if (!fields.terms) errors.terms = "Accept the gym rules to continue";

  return errors;
}

/**
 * A member account is not tied to a gym: you join one by subscribing, and you
 * can train at several on the same account.
 */
export function SignUpForm() {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
    setErrors((current) =>
      current[key] ? { ...current, [key]: undefined } : current,
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailed(null);

    const found = validate(fields);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setSubmitting(true);
    try {
      await signUpMember({
        name: fields.name.trim(),
        phone: fields.phone,
        password: fields.password,
      });
      router.push("/discover");
    } catch (error: unknown) {
      setFailed(messageOf(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AuthHeading
        title="Create your account"
        subtitle="One account for every IronCore gym. Join a gym by picking a plan once you are in."
      />

      <form onSubmit={handleSubmit} noValidate>
        <InputField
          label="Full name"
          autoComplete="name"
          placeholder="Chidinma Okafor"
          value={fields.name}
          error={errors.name}
          onChange={(event) => set("name", event.target.value)}
        />

        <InputField
          label="Phone number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="080X XXX XXXX"
          value={fields.phone}
          error={errors.phone}
          onChange={(event) => set("phone", event.target.value)}
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
              I accept the{" "}
              <span className="font-semibold text-ink">gym rules</span> and the
              IronCore terms.
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
          {submitting ? "Creating your account…" : "Create account"}
        </Button>
      </form>

      <Helper className="mt-3 text-center">
        Your password protects your check-in code, so keep it to yourself.
      </Helper>

      <p className="mt-6 text-center text-[13px] text-steel-soft">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="font-bold text-ink underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
