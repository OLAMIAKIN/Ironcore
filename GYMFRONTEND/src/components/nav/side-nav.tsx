"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarbellIcon, LogOutIcon } from "@/components/icons";
import { signOut } from "@/lib/session";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { isActive, type NavItem } from "./nav-config";

/**
 * Persistent rail for tablet and up. It replaces the phone tab bar rather than
 * sitting alongside it, so only one primary nav is ever visible.
 */
export function SideNav({
  items,
  brand,
  user,
}: {
  items: NavItem[];
  /** The gym this session belongs to, shown under the wordmark. */
  brand: string;
  user: { name: string; role: string };
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-sidebar shrink-0 flex-col bg-ink text-white md:flex">
      <Link
        href="/home"
        className="flex items-center gap-3 px-5 pt-7 pb-6 lg:px-6"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-hazard text-white">
          <BarbellIcon />
        </span>
        <span>
          <span className="block font-display text-[22px] leading-none tracking-[1px]">
            IronCore
          </span>
          <span className="block max-w-[150px] truncate text-2xs font-semibold tracking-[1.5px] text-mist-dim uppercase">
            {brand}
          </span>
        </span>
      </Link>

      <nav aria-label="Primary" className="flex-1 space-y-1 px-3 lg:px-4">
        {items.map((item) => (
          <SideNavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      <div className="flex items-center gap-3 border-t border-white/10 px-5 py-5 lg:px-6">
        <Avatar name={user.name} tone="steel" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{user.name}</p>
          <p className="truncate text-2xs tracking-[1px] text-mist-dim uppercase">
            {user.role}
          </p>
        </div>
        <Link
          href="/sign-in"
          onClick={() => void signOut()}
          aria-label="Sign out"
          title="Sign out"
          className="text-mist-dim transition-colors hover:text-hazard"
        >
          <LogOutIcon className="size-[18px]" />
        </Link>
      </div>
    </aside>
  );
}

function SideNavLink({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const active = isActive(pathname, item);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 overflow-hidden rounded-ctl px-3 py-2.5 transition-colors",
        active
          ? "bg-ink-soft text-white"
          : "text-mist hover:bg-white/5 hover:text-white",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="nav-rail absolute inset-y-1.5 left-0 w-[3px] rounded-r-sm"
        />
      )}
      <item.icon className={cn("size-[18px] shrink-0", active && "text-hazard")} />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold">{item.label}</span>
        {item.hint && (
          <span className="block truncate text-2xs text-mist-dim">
            {item.hint}
          </span>
        )}
      </span>
    </Link>
  );
}
