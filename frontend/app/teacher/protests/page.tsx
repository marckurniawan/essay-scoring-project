import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import RoleGuard from "@/components/role-guard";
import TeacherScoreProtests from "@/components/teacher-score-protests";

export default function TeacherProtestsPage() {
  return (
    <RoleGuard requiredRole="teacher">
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <AppHeader page="teacher" />

        <div className="mx-auto max-w-7xl space-y-6 px-5 py-7 sm:px-8 lg:py-9">
          <section className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                Teacher workspace
              </p>

              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                Score Protests
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Review student score protests, check their reasons, and decide
                whether to accept or reject each request.
              </p>
            </div>

            <Link
              href="/teacher"
              className="inline-flex w-fit items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              &larr; Back to dashboard
            </Link>
          </section>

          <TeacherScoreProtests />

          <footer className="border-t border-slate-200 pt-5 text-xs text-slate-500">
            Essay Scoring · Teacher workspace
          </footer>
        </div>
      </main>
    </RoleGuard>
  );
}