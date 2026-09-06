import type { Metadata } from "next";
import { HomeClient } from "./home-client";

export const metadata: Metadata = {
  title: "Home · IronCore",
};

export default function HomePage() {
  return <HomeClient />;
}
