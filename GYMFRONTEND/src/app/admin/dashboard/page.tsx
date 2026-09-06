import type { Metadata } from "next";
import { DashboardClient } from "./dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard · IronCore",
};

export default function AdminDashboardPage() {
  return <DashboardClient />;
}
