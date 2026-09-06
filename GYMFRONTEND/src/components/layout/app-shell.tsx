"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { BarbellIcon, LogOutIcon } from "@/components/icons";
import { BottomNav } from "@/components/nav/bottom-nav";
import {
  canAccessAdmin,
  homeRouteFor,
  MEMBER_NAV,
  STAFF_NAV,
} from "@/components/nav/nav-config";
import { SideNav } from "@/components/nav/side-nav";
import { useMyGym, useMySubscriptions } from "@/lib/domain";
import { ROLE_LABELS, signOut, useSession, type Role } from "@/lib/session";

type StaffRole = Exclude<Role, "member">;

/**
 * One shell, two shapes: a tab bar under the content on phones, a persistent
 * dark rail beside it from `md` up. Which links appear comes from the signed-in
 * role, so a front-desk scanner never sees the admin sections.
 *
 * It is also the gate: a screen inside the shell is never rendered for someone
 * who is not signed in as the right audience.
 */
export function AppShell({
  audience,
  children,
}: {
  audience: "member" | "staff";
  children: ReactNode;
}) {
  const router = useRouter();
  const { user, status } = useSession();

  const wrongAudience =
    user &&
    ((audience === "member" && user.role !== "member") ||
      (audience === "staff" && user.role === "member"));

  useEffect(() => {
    if (status !== "ready") return;

    if (!user) {
      router.replace(audience === "member" ? "/sign-in" : "/gym/sign-in");
      return;
    }

    if (wrongAudience) {
      router.replace(user.role === "member" ? "/home" : "/admin/dashboard");
      return;
    }

    // A front-desk login only owns the scanner.
    if (user.role !== "member" && !canAccessAdmin(user.role)) {
      router.replace(homeRouteFor(user.role));
    }
  }, [status, user, wrongAudience, audience, router]);

  if (status !== "ready" || !user || wrongAudience) return <ShellSkeleton />;

  return audience === "member" ? (
    <MemberShell name={user.name}>{children}</MemberShell>
  ) : (
    <StaffShell name={user.name} role={user.role as StaffRole}>
      {children}
    </StaffShell>
  );
}

function MemberShell({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  const { data } = useMySubscriptions();
  const home = data?.items[0]?.gym;

  return (
    <Shell
      items={MEMBER_NAV}
      brand={home ? `${home.name} — ${home.branch}` : "IronCore"}
      user={{ name, role: "Member" }}
    >
      {children}
    </Shell>
  );
}

function StaffShell({
  name,
  role,
  children,
}: {
  name: string;
  role: StaffRole;
  children: ReactNode;
}) {
  const { data } = useMyGym();
  if (!canAccessAdmin(role)) return <ShellSkeleton />;

  return (
    <Shell
      items={STAFF_NAV[role]}
      brand={data ? `${data.name} — ${data.branch}` : "Your gym"}
      user={{ name, role: ROLE_LABELS[role] }}
    >
      {children}
    </Shell>
  );
}

function Shell({
  items,
  brand,
  user,
  children,
}: {
  items: React.ComponentProps<typeof SideNav>["items"];
  brand: string;
  user: { name: string; role: string };
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <SideNav items={items} brand={brand} user={user} />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main className="flex-1 pb-28 md:pb-14">{children}</main>
        <BottomNav items={items} />
      </div>
    </div>
  );
}

/** Phone-only brand bar — the rail is hidden at this width. */
function MobileTopBar() {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-chalk/90 px-5 py-3 backdrop-blur md:hidden">
      <Link href="/home" className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-[10px] bg-hazard text-white">
          <BarbellIcon className="size-4" />
        </span>
        <span className="font-display text-[18px] leading-none tracking-[1px] text-ink">
          IronCore
        </span>
      </Link>
      <button
        type="button"
        onClick={async () => {
          await signOut();
          router.replace("/sign-in");
        }}
        className="flex items-center gap-1.5 text-micro font-semibold tracking-[1px] text-steel-soft uppercase"
      >
        <LogOutIcon className="size-4" />
        Sign out
      </button>
    </header>
  );
}

/** Held while the session is being confirmed, so nothing flashes. */
function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh">
      <div className="hidden w-sidebar shrink-0 bg-ink md:block" />
      <div className="flex-1 p-6">
        <div className="mx-auto w-full max-w-content animate-pulse space-y-4">
          <div className="h-10 w-52 rounded-card bg-paper" />
          <div className="h-40 rounded-card bg-paper" />
          <div className="h-64 rounded-card bg-paper" />
        </div>
      </div>
    </div>
  );
}
