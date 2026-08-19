import { cn } from "@/lib/utils";

/**
 * Brand mark: a smiling olive (stem + two leaves + face), drawn as inline SVG
 * with currentColor so it stays crisp at any size and never needs an image.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 500 500"
      fill="none"
      className={cn("text-[var(--color-check)]", className)}
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Stem branch */}
        <path d="M225 100C235 150 230 195 205 225" />

        {/* Left leaf */}
        <path d="M228 145C150 120 135 180 220 180" />

        {/* Right leaf */}
        <path d="M233 130C310 95 330 155 238 162" />

        {/* Main olive body */}
        <path
          d="M250 190
             C315 190, 345 240, 345 315
             C345 390, 315 420, 250 420
             C185 420, 155 390, 155 315
             C155 240, 185 190, 250 190Z"
        />

        {/* Eyes */}
        <circle cx={220} cy={275} r={10} fill="currentColor" stroke="none" />
        <circle cx={280} cy={275} r={10} fill="currentColor" stroke="none" />

        {/* Smile */}
        <path d="M225 315C235 340, 265 340, 275 315" strokeWidth={10} />

        {/* Highlight on the olive body */}
        <path
          d="M185 295C182 320, 190 348, 205 365"
          strokeWidth={8}
          opacity={0.5}
        />
      </g>
    </svg>
  );
}
