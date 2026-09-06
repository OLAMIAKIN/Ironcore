"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { isActive, type NavItem } from "./nav-config";

/** Phone-only tab bar. Pinned to the bottom and padded for the home bar. */
export function BottomNav({
  items,
  className,
}: {
  items: NavItem[];
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-paper px-2 pt-2.5 pb-[max(env(safe-area-inset-bottom),14px)] md:hidden",
        className,
      )}
    >
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-ctl py-1 text-2xs font-semibold",
              active ? "text-ink" : "text-nav-idle",
            )}
          >
            <item.icon />
            {item.label}
            <span
              className={cn(
                "h-[3px] w-5 rounded-sm",
                active ? "bg-hazard" : "bg-transparent",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
