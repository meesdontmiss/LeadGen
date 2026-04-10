import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-2 overflow-hidden rounded-full bg-stone-900/10",
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-[color:var(--accent)] transition-[width]"
        style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
      />
    </div>
  );
}
