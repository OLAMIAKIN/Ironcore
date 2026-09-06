import type { Metadata } from "next";
import { MembersClient } from "./members-client";

export const metadata: Metadata = {
  title: "Members · IronCore Gym",
};

export default function AdminMembersPage() {
  return <MembersClient />;
}
