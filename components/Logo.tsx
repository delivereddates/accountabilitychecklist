import { cn } from "@/lib/utils";

/**
 * Brand mark: a sleek inverted-V that reads as an "A" (two diagonals + crossbar),
 * drawn as inline SVG so it stays crisp at any size and never needs an image.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("text-[var(--color-check)]", className)}
      aria-hidden="true"
    >
      <path
        d="M3 19 12 4 21 19"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 14h8"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    </svg>
  );
}
