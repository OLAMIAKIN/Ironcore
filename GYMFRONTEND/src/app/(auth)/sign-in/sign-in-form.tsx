"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRightIcon } from "@/components/icons";
import { AuthHeading } from "@/components/layout/auth-layout";
import { HazardTape, Helper } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/field";
import { messageOf } from "@/lib/api";
import { signIn } from "@/lib/session";

/**
 * Members sign in with the number their gym has on file. Which gyms they train
 * at comes from the account itself once they are in, so there is nothing to
 * pick here.
 */
export function SignInForm() {
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
      found.phone = "Enter a valid phone number";
    }
    if (password.length < 8) found.password = "Passwords are 8+ characters";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const user = await signIn(phone, password);
      // A staff number typed into the member form still lands somewhere useful.
      router.push(user.role === "member" ? "/home" : "/admin/dashboard");
    } catch (error: unknown) {
      setFailed(messageOf(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AuthHeading
        title="Welcome back"
        subtitle="Sign in with the number your gym has on file."
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
          <div
            role="alert"
            className="mb-3.5 rounded-ctl border border-hazard/30 bg-hazard-dim px-3.5 py-3"
          >
            <p className="text-[13px] font-semibold text-ink">{failed}</p>
            <p className="mt-1 text-helper text-steel">
              No account yet?{" "}
              <Link href="/sign-up" className="font-bold underline">
                Create one
              </Link>
              .
            </p>
          </div>
        )}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
          {!submitting && <ArrowRightIcon className="size-4" />}
        </Button>
      </form>

      <p className="mt-4 text-center text-[13px] text-steel-soft">
        New here?{" "}
        <Link
          href="/sign-up"
          className="font-bold text-ink underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>

      <HazardTape animated className="my-7" />

      <Helper className="text-center">
        Just looking?{" "}
        <Link
          href="/discover"
          className="font-bold text-ink underline-offset-4 hover:underline"
        >
          Find a gym near you
        </Link>{" "}
        without signing up.
      </Helper>

      <p className="mt-6 text-center text-micro font-semibold tracking-[1px] text-steel-soft uppercase">
        Run a gym?{" "}
        <Link href="/gym/sign-in" className="text-hazard hover:underline">
          Sign in here
        </Link>
      </p>
    </>
  );
}
