import type { Metadata } from "next";
import { ScannerClient } from "./scanner-client";

export const metadata: Metadata = {
  title: "Door scanner · IronCore Gym",
};

export default function ScannerPage() {
  return <ScannerClient />;
}
