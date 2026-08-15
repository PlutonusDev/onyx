/**
 * The app mark: a hollow diamond with a solid core. Deliberately abstract —
 * no vendor iconography anywhere in the UI.
 */
export default function Glyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 2.6 21.4 12 12 21.4 2.6 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12 8.4 15.6 12 12 15.6 8.4 12Z" fill="currentColor" />
    </svg>
  );
}
