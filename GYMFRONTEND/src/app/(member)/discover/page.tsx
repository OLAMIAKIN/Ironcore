import type { Metadata } from "next";
import { DiscoverClient } from "./discover-client";

export const metadata: Metadata = {
  title: "Find a gym · IronCore Gym",
};

export default function DiscoverPage() {
  return <DiscoverClient />;
}
