import type { Metadata } from "next";
import { SetupClient } from "./setup-client";

export const metadata: Metadata = {
  title: "Setup · IronCore",
};

export default function AdminSetupPage() {
  return <SetupClient />;
}
