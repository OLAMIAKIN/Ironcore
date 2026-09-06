"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthHeading } from "@/components/layout/auth-layout";
import { HazardTape, Helper } from "@/components/layout/page";
import { homeRouteFor } from "@/components/nav/nav-config";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/field";
import { messageOf } from "@/lib/api";
import { signIn } from "@/lib/session";

/**
 * Staff sign-in. Owners, managers and front desk all come through here; the
 * role on the account decides where they land.
 */
export function GymSignInForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ phone?: string; password?: string }>(
    {},
  );
  const [failed, setFailed] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailed(null);

    const found: { phone?: string; password?: string } = {};
    if (phone.replace(/\D/g, "").length < 10) {
      found.phone = "Enter the phone number on the account";
    }
    if (password.length < 8) found.password = "Passwords are 8+ characters";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const user = await signIn(phone, password);

      if (user.role === "member") {
        setFailed("That number is a member account, not a gym login");
        return;
      }

      router.push(homeRouteFor(user.role));
    } catch (error: unknown) {
      setFailed(messageOf(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AuthHeading
        title="Gym sign in"
        subtitle="For owners, managers and front desk. Members sign in on the other side."
      />

      <form onSubmit={handleSubmit} noValidate>
        <InputField
          label="Phone number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="080X XXX XXXX"
          value={phone}
          error={errors.phone}
          onChange={(event) => {
            setPhone(event.target.value);
            setErrors((current) => ({ ...current, phone: undefined }));
          }}
        />

        <InputField
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          error={errors.password}
          onChange={(event) => {
            setPassword(event.target.value);
            setErrors((current) => ({ ...current, password: undefined }));
          }}
        />

        {failed && (
          <p role="alert" className="mb-3.5 text-xs font-medium text-hazard">
            {failed}
          </p>
        )}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-steel-soft">
        New gym?{" "}
        <Link
          href="/gym/sign-up"
          className="font-bold text-ink underline-offset-4 hover:underline"
        >
          Register your gym
        </Link>
      </p>

      <HazardTape animated className="my-7 opacity-40" />

      <Helper className="text-center">
        Staff logins are created by the gym owner under Staff &amp; roles.
      </Helper>
    </>
  );
}
