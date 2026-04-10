import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-stone-700",
        secondary:
          "bg-white/75 text-[color:var(--foreground)] ring-1 ring-[color:var(--line)] hover:bg-white",
        ghost:
          "bg-transparent text-[color:var(--foreground)] hover:bg-white/65",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant }), className)} {...props} />
  );
}
