/** "Chidinma Okafor" -> "CO" */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/** 15000 -> "₦15,000" */
export function naira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}

/** 187000 -> "₦187k" — for the compact stat tiles. */
export function nairaCompact(amount: number): string {
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}m`;
  if (amount >= 1_000) return `₦${Math.round(amount / 1_000)}k`;
  return naira(amount);
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function daysLeftLabel(days: number): string {
  if (days <= 0) return "Expired";
  return `${days} day${days === 1 ? "" : "s"} left`;
}
