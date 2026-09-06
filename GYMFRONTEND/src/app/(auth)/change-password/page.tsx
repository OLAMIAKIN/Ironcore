import { Suspense } from "react";
import type { Metadata } from "next";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = {
  title: "Change password · IronCore",
};

export default function ChangePasswordPage() {
  // The form reads `?first=1` to know it was sent here rather than chosen.
  return (
    <Suspense>
      <ChangePasswordForm />
    </Suspense>
  );
}
