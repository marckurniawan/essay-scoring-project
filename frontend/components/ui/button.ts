export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "success"
  | "dangerOutline"
  | "link"
  | "onDark";

const BASE =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS: Record<ButtonVariant, string> = {
  // Main call-to-action: create/save/submit/start — the one action a page wants you to take.
  primary:
    "bg-gradient-to-r from-sky-700 to-teal-500 text-white hover:from-sky-800 hover:to-teal-600 focus-visible:ring-sky-700",
  // Secondary action: back, refresh, cancel, toggle details — supporting actions beside a primary one.
  secondary:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 focus-visible:ring-sky-700",
  // Low-emphasis action with no border, e.g. inline row actions (delete a criterion/question).
  ghost:
    "text-slate-600 hover:bg-slate-100 focus-visible:ring-sky-700",
  // Positive/confirm action (accept a protest).
  success:
    "bg-emerald-700 text-white hover:bg-emerald-800 focus-visible:ring-emerald-600",
  // Negative/reject action, outlined so it reads as less final than a solid red button.
  dangerOutline:
    "border border-red-300 bg-white text-red-700 hover:bg-red-50 focus-visible:ring-red-600",
  // Text-only inline action (e.g. "Hapus pencarian"), no pill chrome at all.
  link:
    "min-h-0 rounded-none p-0 text-sky-700 underline underline-offset-4 hover:text-sky-800 focus-visible:ring-offset-0",
  // Secondary action placed directly on the navbar's gradient background.
  onDark:
    "border border-white/25 bg-white/10 text-white shadow-sm backdrop-blur-sm hover:border-red-300 hover:bg-red-500/20 focus-visible:ring-white/60 focus-visible:ring-offset-cyan-800",
};

export function buttonClass(
  variant: ButtonVariant = "secondary",
  className = "",
): string {
  return `${BASE} ${VARIANTS[variant]} ${className}`.trim();
}
