"use client";

/**
 * Waiting state built from the product's own mark rather than generic dots:
 * the diamond outline draws itself on a loop while the core pulses, and the
 * label is revealed by a light sweep passing across it.
 *
 * Pure CSS/SVG — no JS timers, so it costs nothing while a response streams.
 */
export default function ThinkingIndicator({ label = "Thinking" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <svg viewBox="0 0 24 24" className="size-4 overflow-visible" aria-hidden="true">
        <path
          d="M12 2.6 21.4 12 12 21.4 2.6 12Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          className="trace-path text-amber-500/25"
        />
        <path
          d="M12 2.6 21.4 12 12 21.4 2.6 12Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          className="trace-path trace-run text-amber-400"
        />
        <path
          d="M12 8.4 15.6 12 12 15.6 8.4 12Z"
          className="core-pulse text-amber-400"
          fill="currentColor"
        />
      </svg>

      <span className="shimmer-text text-sm" aria-live="polite">
        {label}
      </span>
    </div>
  );
}
