import type { Metadata } from "next";
import { StaffClient } from "./staff-client";

export const metadata: Metadata = {
  title: "Staff · IronCore Gym",
};

export default function AdminStaffPage() {
  return <StaffClient />;
}
