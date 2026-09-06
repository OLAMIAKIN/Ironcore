import type { Metadata } from "next";
import { GuestPassClient } from "./guest-pass-client";

export const metadata: Metadata = {
  title: "Day pass · IronCore",
};

export default async function GuestPassPage({
  searchParams,
}: PageProps<"/guest-pass">) {
  const { gym } = await searchParams;
  const requested = Array.isArray(gym) ? gym[0] : gym;

  // The gym is validated by the API; this only preselects the dropdown.
  return <GuestPassClient initialGymId={requested ?? null} />;
}
