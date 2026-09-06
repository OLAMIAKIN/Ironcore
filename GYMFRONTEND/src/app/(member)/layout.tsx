import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

export default function MemberLayout({ children }: { children: ReactNode }) {
  return <AppShell audience="member">{children}</AppShell>;
}
