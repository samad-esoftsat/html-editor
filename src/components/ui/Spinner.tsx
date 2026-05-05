export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin">
      <circle
        cx="12"
        cy="12"
        r="10"
        strokeWidth="3"
        stroke="currentColor"
        strokeOpacity="0.2"
        fill="none"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        strokeWidth="3"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
