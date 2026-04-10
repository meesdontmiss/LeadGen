import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-full border border-[color:var(--line)] bg-white/80 px-4 py-2.5 text-sm text-[color:var(--foreground)] outline-none transition-colors placeholder:text-stone-500 focus:border-[color:var(--accent)]",
        className,
      )}
      {...props}
    />
  );
}
