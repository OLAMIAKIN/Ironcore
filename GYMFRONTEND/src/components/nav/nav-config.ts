import type { Route } from "next";
import type { ComponentType, SVGProps } from "react";
import {
  ChartIcon,
  HomeIcon,
  MembersIcon,
  PackagesIcon,
  ScanIcon,
  SearchIcon,
  SettingsIcon,
  TicketIcon,
  UserIcon,
} from "@/components/icons";
import type { Role } from "@/lib/session";

export type NavItem = {
  label: string;
  href: Route;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Extra path prefixes that should also light this item up. */
  match?: string[];
  /** Longer wording used in the sidebar, where there is room for it. */
  hint?: string;
};

export const MEMBER_NAV: NavItem[] = [
  { href: "/home", label: "Home", icon: HomeIcon, hint: "Your check-in code" },
  { href: "/discover", label: "Find", icon: SearchIcon, hint: "Gyms near you" },
  {
    href: "/subscribe",
    label: "Plan",
    icon: PackagesIcon,
    hint: "Subscribe or renew",
  },
  {
    href: "/guest-pass",
    label: "Pass",
    icon: TicketIcon,
    hint: "Buy a day pass",
  },
];

const OVERVIEW: NavItem = {
  href: "/admin/dashboard",
  label: "Overview",
  icon: ChartIcon,
  hint: "Today at a glance",
};

const MEMBERS: NavItem = {
  href: "/admin/members",
  label: "Members",
  icon: MembersIcon,
  hint: "Roster and imports",
};

const PAYMENTS: NavItem = {
  href: "/admin/payments",
  label: "Money",
  icon: PackagesIcon,
  hint: "Payments and settlements",
};

const STAFF: NavItem = {
  href: "/admin/staff",
  label: "Staff",
  icon: UserIcon,
  hint: "Who can do what",
};

const SCANNER: NavItem = {
  href: "/staff/scanner",
  label: "Scanner",
  icon: ScanIcon,
  hint: "Front-desk door check",
};

const SETUP: NavItem = {
  href: "/admin/setup",
  label: "Setup",
  icon: SettingsIcon,
  hint: "Packages & trainers",
};

/**
 * What each role is allowed to see. A scanner gets the door screen and nothing
 * else, which is the whole point of the role.
 */
export const STAFF_NAV: Record<Exclude<Role, "member">, NavItem[]> = {
  owner: [OVERVIEW, MEMBERS, PAYMENTS, STAFF, SCANNER, SETUP],
  manager: [OVERVIEW, MEMBERS, SCANNER],
  scanner: [SCANNER],
};

/**
 * The one front door. Signing out sends everyone here, staff included: this
 * page takes any account's phone number and routes on the role it finds, so
 * nobody has to remember which of two sign-in pages was theirs.
 */
export const SIGN_IN = "/sign-in" as Route;

/** Where a role lands after signing in. */
export function homeRouteFor(role: Role): Route {
  return role === "scanner" ? "/staff/scanner" : "/admin/dashboard";
}

export function canAccessAdmin(role: Role): boolean {
  return role !== "scanner";
}

/** A nav item owns its own path and anything nested under it. */
export function isActive(pathname: string, item: NavItem): boolean {
  const prefixes = [item.href as string, ...(item.match ?? [])];
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
