
import Link from "next/link";
import LogoutButton from "./logout-button";

type AppHeaderProps = {
  page: "teacher" | "student";
};

export default function AppHeader({ page }: AppHeaderProps) {
  const isTeacher = page === "teacher";

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="flex flex-wrap items-center gap-2">
        {page === "student" ? (
          <>
            <Link
              href="/student"
              className="border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Daftar ujian
            </Link>

            <Link
              href="/student/history"
              className="border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Ringkasan
            </Link>

            <Link
              href="/student/attempts"
              className="border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Total pengerjaan
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/teacher"
              className="border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Dashboard
            </Link>

            <Link
              href="/teacher/protests"
              className="border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Review protes
            </Link>
          </>
        )}

        <LogoutButton />
      </nav>
    </header>
  );
}
