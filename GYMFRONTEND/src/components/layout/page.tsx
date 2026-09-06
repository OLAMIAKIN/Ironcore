import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Responsive page primitives. Everything is a normal document-flow block — the
 * app scrolls the window, not an inner pane, so the same markup works from a
 * 360px phone up to a wide desktop.
 */

/** Centres page content and grows its gutters with the viewport. */
export function Container({
  children,
  className,
  width = "wide",
}: {
  children: ReactNode;
  className?: string;
  /** `wide` for dashboards and lists, `narrow` for single-column forms. */
  width?: "wide" | "narrow";
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-6 lg:px-10",
        width === "wide" ? "max-w-content" : "max-w-[640px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  label,
  title,
  description,
  right,
  className,
}: {
  label?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-4 pt-6 pb-5 lg:pt-10 lg:pb-7",
        className,
      )}
    >
      <div className="min-w-0">
        {label && (
          <p className="text-micro font-semibold tracking-[1.5px] text-steel-soft uppercase">
            {label}
          </p>
        )}
        <h1 className="mt-1 font-display text-[30px] leading-none tracking-[0.3px] text-ink sm:text-[36px] lg:text-[44px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-prose text-helper leading-[1.6] text-steel-soft lg:text-sm">
            {description}
          </p>
        )}
      </div>
      {right && <div className="flex shrink-0 items-center gap-3">{right}</div>}
    </header>
  );
}

/**
 * The main/rail split used on wide screens. Below `lg` the rail simply falls
 * under the main column, so mobile keeps the single-column reading order.
 */
export function Split({
  main,
  rail,
  className,
}: {
  main: ReactNode;
  rail: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:gap-8",
        className,
      )}
    >
      <div className="min-w-0">{main}</div>
      <div className="min-w-0 lg:sticky lg:top-8">{rail}</div>
    </div>
  );
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  /** Optional trailing control, e.g. a "See all" link. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-6 lg:mb-8", className)}>
      {title && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <SectionTitle className="mb-0">{title}</SectionTitle>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function SectionTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "mb-2.5 font-display text-[19px] tracking-[0.3px] text-ink lg:text-[22px]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

export function Helper({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-helper leading-[1.5] text-steel-soft", className)}>
      {children}
    </p>
  );
}

/** Diagonal hazard-tape rule from the mockup. */
export function HazardTape({
  className,
  animated = false,
}: {
  className?: string;
  /** Marches the stripes sideways — stilled by prefers-reduced-motion. */
  animated?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "hazard-tape my-4 opacity-90",
        animated && "hazard-tape-live",
        className,
      )}
    />
  );
}
