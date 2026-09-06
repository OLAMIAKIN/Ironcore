import type { Metadata } from "next";
import { GymSignInForm } from "./gym-sign-in-form";

export const metadata: Metadata = {
  title: "Gym sign in · IronCore",
};

export default function GymSignInPage() {
  return <GymSignInForm />;
}
