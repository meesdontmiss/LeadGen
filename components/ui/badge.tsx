import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
  {
    variants: {
      variant: {
        neutral:
          "border-[color:var(--line)] bg-white/70 text-[color:var(--foreground)]",
        positive:
          "border-emerald-300/60 bg-emerald-50 text-emerald-700",
        warning:
          "border-amber-300/60 bg-amber-50 text-amber-700",
        critical:
          "border-rose-300/60 bg-rose-50 text-rose-700",
        muted:
          "border-transparent bg-stone-900 text-stone-50",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
