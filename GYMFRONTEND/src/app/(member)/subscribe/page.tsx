import { Suspense } from "react";
import type { Metadata } from "next";
import { SubscribeClient } from "./subscribe-client";

export const metadata: Metadata = {
  title: "Choose a plan · IronCore Gym",
};

export default function SubscribePage() {
  // The screen reads `?gym=` to land on the gym "Find a gym" was showing, and
  // a search param is only readable once the page is on the client.
  return (
    <Suspense>
      <SubscribeClient />
    </Suspense>
  );
}
