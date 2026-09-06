"use client";

import { Avatar } from "@/components/ui/avatar";
import { useMyGym } from "@/lib/domain";
import { useSession } from "@/lib/session";

/** The gym the signed-in staff member belongs to. */
export function GymLabel() {
  const { data } = useMyGym();
  return <>{data ? `${data.name} — ${data.branch}` : "Your gym"}</>;
}

export function StaffAvatar() {
  const { user } = useSession();
  if (!user) return null;
  return <Avatar name={user.name} className="size-11" />;
}
