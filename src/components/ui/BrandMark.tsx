interface Props {
  size?: number;
  className?: string;
}

export function BrandMark({ size = 28, className }: Props) {
  return (
    <svg
      role="img"
      aria-label="GlobalTT"
      width={size}
      height={size}
      viewBox="0 0 28 28"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect data-mark="g" width="28" height="28" rx="6" fill="currentColor" />
      <path
        data-mark="t"
        d="M8 10h12v2.6H15.4V22h-2.8V12.6H8z"
        fill="var(--color-brand)"
      />
    </svg>
  );
}
