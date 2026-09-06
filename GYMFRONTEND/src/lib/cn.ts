type ClassValue = string | number | null | undefined | false;

/** Tiny classnames joiner — no runtime deps, no conflict resolution needed. */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
