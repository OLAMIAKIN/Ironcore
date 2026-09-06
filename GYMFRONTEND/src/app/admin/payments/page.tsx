import type { Metadata } from "next";
import { PaymentsClient } from "./payments-client";

export const metadata: Metadata = {
  title: "Payments · IronCore Gym",
};

export default function AdminPaymentsPage() {
  return <PaymentsClient />;
}
