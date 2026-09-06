"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BarbellIcon, ChartIcon, LogOutIcon } from "@/components/icons";
import { canAccessAdmin } from "@/components/nav/nav-config";
import { useMyGym } from "@/lib/domain";
import { ROLE_LABELS, signOut, useStaffSession } from "@/lib/session";

export function StaffChrome({ children }: { children: ReactNode }) {
  const session = useStaffSession();
  const gym = useMyGym();
  // A front-desk login has nowhere else to go, so it gets no dashboard link.
  const showDashboard = session ? canAccessAdmin(session.role) : false;

  return (
    <div className="flex min-h-dvh flex-col bg-void text-white">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-3.5 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-hazard">
            <BarbellIcon className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-[18px] leading-none tracking-[1px]">
              {gym.data ? `${gym.data.name} — ${gym.data.branch}` : "Your gym"}
            </p>
            <p className="truncate text-2xs tracking-[1.5px] text-mist-dim uppercase">
              {session ? `${session.name} · ${ROLE_LABELS[session.role]}` : "Signing in…"}
            </p>
          </div>
        </div>

        <nav className="flex shrink-0 items-center gap-5 text-micro font-semibold tracking-[1px] uppercase">
          {showDashboard && (
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-1.5 text-mist transition-colors hover:text-white"
            >
              <ChartIcon className="size-4" />
              Dashboard
            </Link>
          )}
          <Link
            href="/gym/sign-in"
            onClick={() => void signOut()}
            className="flex items-center gap-1.5 text-mist-dim transition-colors hover:text-hazard"
          >
            <LogOutIcon className="size-4" />
            Sign out
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
