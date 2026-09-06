import Link from "next/link";
import type { ReactNode } from "react";
import { BarbellIcon, CheckIcon } from "@/components/icons";
import { HazardTape } from "@/components/layout/page";

const SELLING_POINTS = [
  "One code opens the door — no cards, no paper receipts.",
  "See what you owe and renew before the gate says no.",
  "Travelling? Buy a day pass at any partner gym.",
];

/**
 * Split layout for sign-in / sign-up. The dark brand panel only appears once
 * there is width to spare; phones get the form alone, edge to edge.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(480px,44%)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink px-12 py-14 text-white lg:flex xl:px-16">
        <Link href="/sign-in" className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-hazard">
            <BarbellIcon />
          </span>
          <span className="font-display text-[26px] leading-none tracking-[1.5px]">
            IronCore
          </span>
        </Link>

        <div className="max-w-md">
          <HazardTape className="mb-8 w-28" />
          <h2 className="font-display text-[52px] leading-[0.95] tracking-[1px] xl:text-[64px]">
            Show up.
            <br />
            Scan in.
            <br />
            <span className="text-hazard">Lift.</span>
          </h2>
          <ul className="mt-9 space-y-3.5">
            {SELLING_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-mist">
                <CheckIcon className="mt-0.5 size-[18px] shrink-0 text-valid" />
                <span className="text-sm leading-[1.5]">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="font-mono text-micro tracking-[1px] text-slate-dim uppercase">
          IronCore Gym · Lekki Phase 1 · Est. 2019
        </p>
      </aside>

      <main className="flex min-h-dvh flex-col justify-center px-5 py-10 sm:px-8 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-[440px]">{children}</div>
      </main>
    </div>
  );
}

/** Heading block for the form column. The logo only shows where the brand panel does not. */
export function AuthHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: ReactNode;
}) {
  return (
    <div className="mb-7 text-center lg:mb-8 lg:text-left">
      <div className="mx-auto mb-3.5 flex size-14 items-center justify-center rounded-2xl bg-hazard text-white lg:hidden">
        <BarbellIcon />
      </div>
      <h1 className="font-display text-[32px] leading-none tracking-[0.5px] text-ink sm:text-[38px]">
        {title}
      </h1>
      <p className="mt-2 text-helper leading-[1.6] text-steel-soft sm:text-sm">
        {subtitle}
      </p>
    </div>
  );
}
