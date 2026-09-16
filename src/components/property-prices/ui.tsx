import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
}) {
  const v =
    variant === "ghost"
      ? "border border-border bg-card text-foreground hover:border-accent/50"
      : variant === "danger"
        ? "border border-border bg-card text-danger hover:border-danger/50"
        : "bg-accent text-white hover:bg-accent/90";
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45",
        v,
        className,
      )}
      {...props}
    />
  );
}

export function FieldLabel({
  children,
  className,
  htmlFor,
}: {
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-muted",
        className,
      )}
    >
      {children}
    </label>
  );
}

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      suppressHydrationWarning
      className={cn(
        "h-11 w-full rounded-md border border-border bg-navy px-3 text-sm text-foreground outline-none ring-accent/40 placeholder:text-muted focus:border-accent/50 focus:ring-2",
        className,
      )}
      {...props}
    />
  );
}

export function SelectInput({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      suppressHydrationWarning
      className={cn(
        "h-11 w-full rounded-md border border-border bg-navy px-3 text-sm text-foreground outline-none ring-accent/40 focus:border-accent/50 focus:ring-2",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Panel({
  title,
  children,
  className,
  kicker,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  kicker?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-xl border border-border bg-card p-4 md:p-6",
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
          {title}
        </h2>
        {kicker ? (
          <span className="font-mono text-xs text-muted">{kicker}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}
