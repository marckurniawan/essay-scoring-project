type UnderlineProps = {
  className?: string;
};

export default function Underline({ className = "" }: UnderlineProps) {
  return (
    <svg
      viewBox="0 0 120 12"
      fill="none"
      aria-hidden="true"
      className={`h-2 w-full text-amber-400 ${className}`}
      preserveAspectRatio="none"
    >
      <path
        d="M2 9c18-6 38-7 58-5 20 2 40 3 58-3"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
