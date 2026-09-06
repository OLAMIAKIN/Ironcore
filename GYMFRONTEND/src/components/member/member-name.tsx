"use client";

import { useSession } from "@/lib/session";

/** First name of whoever is signed in. */
export function MemberName() {
  const { user } = useSession();
  return <>{user?.name.split(" ")[0] ?? "there"}</>;
}
