"use client";

import type {
  ComponentPropsWithRef,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "w-full rounded-ctl border-[1.5px] border-line-strong bg-white px-3.5 py-3 font-body text-sm text-ink placeholder:text-steel-soft focus:outline-2 focus:outline-offset-1 focus:outline-ink";

function FieldShell({
  label,
  htmlFor,
  error,
  className,
  children,
}: {
  label?: string;
  htmlFor?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mb-3.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="mb-1.5 block text-xs font-semibold text-steel"
        >
          {label}
        </label>
      )}
      {children}
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-hazard">
          {error}
        </p>
      )}
    </div>
  );
}

/** `ComponentPropsWithRef` so a caller can focus the input — e.g. a checkout sheet. */
type InputFieldProps = ComponentPropsWithRef<"input"> & {
  label?: string;
  error?: string;
  wrapperClassName?: string;
};

export function InputField({
  label,
  error,
  wrapperClassName,
  className,
  id,
  ...props
}: InputFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <FieldShell
      label={label}
      htmlFor={inputId}
      error={error}
      className={wrapperClassName}
    >
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, error && "border-hazard", className)}
        {...props}
      />
    </FieldShell>
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  wrapperClassName?: string;
};

export function SelectField({
  label,
  error,
  wrapperClassName,
  className,
  id,
  children,
  ...props
}: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <FieldShell
      label={label}
      htmlFor={selectId}
      error={error}
      className={wrapperClassName}
    >
      <select id={selectId} className={cn(CONTROL, className)} {...props}>
        {children}
      </select>
    </FieldShell>
  );
}

type CheckboxFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  error?: string;
};

export function CheckboxField({
  label,
  error,
  className,
  id,
  ...props
}: CheckboxFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="mb-4">
      <div className="flex items-start gap-2.5">
        <input
          id={inputId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          className={cn(
            "mt-0.5 size-[18px] shrink-0 accent-hazard",
            className,
          )}
          {...props}
        />
        <label
          htmlFor={inputId}
          className="text-helper leading-[1.5] text-steel-soft"
        >
          {label}
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-hazard">
          {error}
        </p>
      )}
    </div>
  );
}
