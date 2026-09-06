"use client";

import { useSyncExternalStore } from "react";
import { greeting } from "@/lib/format";

const subscribe = () => () => {};

/**
 * Time-of-day greeting, read from the client's clock. The server snapshot is a
 * neutral string so prerendered markup and hydration can never disagree.
 */
export function Greeting() {
  const text = useSyncExternalStore(
    subscribe,
    () => greeting(),
    () => "Welcome back",
  );

  return <>{text}</>;
}
