import Link from "next/link";
import type { Route } from "next";
import type { ComponentType, SVGProps } from "react";

/** Tappable shortcut tile. Used for the quick actions on Home. */
export function ActionCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: Route;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3.5 rounded-card border border-line bg-paper p-4 transition-colors hover:border-ink lg:p-5"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-hazard-dim text-hazard transition-colors group-hover:bg-hazard group-hover:text-white">
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-btn font-bold text-ink">{title}</span>
        <span className="mt-0.5 block text-helper leading-[1.45] text-steel-soft">
          {description}
        </span>
      </span>
    </Link>
  );
}
