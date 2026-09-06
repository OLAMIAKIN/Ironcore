import type { Metadata } from "next";
import { GymSignUpForm } from "./gym-sign-up-form";

export const metadata: Metadata = {
  title: "Register your gym · IronCore",
};

export default function GymSignUpPage() {
  return <GymSignUpForm />;
}
