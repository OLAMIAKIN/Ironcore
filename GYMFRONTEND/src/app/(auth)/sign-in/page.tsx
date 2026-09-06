import { Suspense } from "react";
import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in · IronCore Gym",
};

export default function SignInPage() {
  // The form reads `?changed=1` after a password change, which is a search
  // param and so only readable on the client.
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
