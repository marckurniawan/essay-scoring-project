import Link from "next/link";

type AppHeaderProps = {
  page: "teacher" | "student";
};

export default function AppHeader({ page }: AppHeaderProps) {
  const isTeacher = page === "teacher";

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link
          href={isTeacher ? "/teacher" : "/student"}
          className="group flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
          aria-label="Essay Scoring home"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-bold tracking-tight text-white">
            ES
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold tracking-tight text-slate-950">
              Essay Scoring
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              {isTeacher ? "Teacher workspace" : "Student workspace"}
            </span>
          </span>
        </Link>

        <Link
          href={isTeacher ? "/student" : "/teacher"}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
        >
          {isTeacher ? "Student Portal" : "Teacher Dashboard"}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </header>
  );
}
