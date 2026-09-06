"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRightIcon } from "@/components/icons";
import { AuthHeading } from "@/components/layout/auth-layout";
import { Helper } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/field";
import { messageOf } from "@/lib/api";
import { changePassword, useSession } from "@/lib/session";

/**
 * Replacing a password. Two people arrive here: someone whose gym created their
 * account and handed them a one-time password across a desk, and anyone who
 * simply wants a new one.
 *
 * The API revokes every session as it saves — including this one — so this ends
 * at the sign-in screen rather than pretending the old session survived.
 */
export function ChangePasswordForm() {
  const router = useRouter();
  const { user, status } = useSession();

  // Set when sign-in bounced them here because their password came from a gym.
  const forced =
    useSearchParams().get("first") === "1" || user?.mustChangePassword === true;

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{
    current?: string;
    next?: string;
    confirm?: string;
  }>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailed(null);

    const found: typeof errors = {};
    if (!current) found.current = "Enter the password you have now";
    if (next.length < 8) found.next = "Use at least 8 characters";
    if (next && next === current) {
      found.next = "Choose something different from your current password";
    }
    if (confirm !== next) found.confirm = "The two passwords do not match";

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await changePassword(current, next);
      router.replace("/sign-in?changed=1");
    } catch (error: unknown) {
      setFailed(messageOf(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "ready" && !user) {
    return (
      <>
        <AuthHeading
          title="Sign in first"
          subtitle="Changing a password needs the password you have now, so sign in with it."
        />
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-hazard"
        >
          Go to sign in
          <ArrowRightIcon className="size-4" />
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthHeading
        title={forced ? "Choose your own password" : "Change your password"}
        subtitle={
          forced
            ? "Your gym set this account up for you, so the password you have was typed out by someone at the front desk. Pick one only you know."
            : "You will be signed out everywhere once it is saved."
        }
      />

      <form onSubmit={handleSubmit} noValidate>
        <InputField
          label={forced ? "The password your gym gave you" : "Current password"}
          type="password"
          autoComplete="current-password"
          value={current}
          error={errors.current}
          onChange={(event) => {
            setCurrent(event.target.value);
            if (errors.current) setErrors((e) => ({ ...e, current: undefined }));
          }}
        />

        <InputField
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={next}
          error={errors.next}
          onChange={(event) => {
            setNext(event.target.value);
            if (errors.next) setErrors((e) => ({ ...e, next: undefined }));
          }}
        />

        <InputField
          label="Repeat the new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          error={errors.confirm}
          onChange={(event) => {
            setConfirm(event.target.value);
            if (errors.confirm) setErrors((e) => ({ ...e, confirm: undefined }));
          }}
        />

        {failed && (
          <p role="alert" className="mb-3 text-xs font-medium text-hazard">
            {failed}
          </p>
        )}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save new password"}
          <ArrowRightIcon className="size-4" />
        </Button>
      </form>

      <Helper className="mt-4 text-center">
        {forced ? (
          "Once this is saved, the code your gym gave you stops working."
        ) : (
          <Link href="/home" className="font-semibold text-hazard">
            Back to your account
          </Link>
        )}
      </Helper>
    </>
  );
}
