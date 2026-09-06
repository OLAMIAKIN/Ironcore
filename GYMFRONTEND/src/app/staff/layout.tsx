import type { ReactNode } from "react";
import { StaffChrome } from "./staff-chrome";

/**
 * Front-desk chrome. This screen lives on a tablet propped by the door, so it
 * runs dark and full-bleed with no app nav competing for attention.
 */
export default function StaffLayout({ children }: { children: ReactNode }) {
  return <StaffChrome>{children}</StaffChrome>;
}
