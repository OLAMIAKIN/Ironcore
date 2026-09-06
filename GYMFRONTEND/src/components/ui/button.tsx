import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Route } from "next";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "dark" | "ghost" | "valid" | "token";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-hazard text-white hover:bg-[#ec4b28]",
  dark: "bg-ink text-white hover:bg-ink-soft",
  ghost:
    "border-[1.5px] border-line-ghost bg-transparent text-ink hover:bg-black/[0.03]",
  valid: "bg-valid text-white hover:bg-[#379256]",
  token: "bg-token text-ink hover:bg-[#f0bc32]",
};

const BASE =
  "items-center justify-center gap-2 rounded-ctl p-[15px] text-btn font-bold transition-[transform,background-color] duration-100 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /** Buttons fill their column by default; opt out inside toolbars. */
  fullWidth?: boolean;
};

export function Button({
  variant = "primary",
  fullWidth = true,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        BASE,
        VARIANTS[variant],
        fullWidth ? "flex w-full" : "inline-flex",
        className,
      )}
      {...props}
    />
  );
}

/** Same skin as `Button`, but it navigates. */
export function ButtonLink({
  href,
  variant = "primary",
  fullWidth = true,
  className,
  children,
}: {
  href: Route;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        BASE,
        VARIANTS[variant],
        fullWidth ? "flex w-full" : "inline-flex",
        className,
      )}
    >
      {children}
    </Link>
  );
}
