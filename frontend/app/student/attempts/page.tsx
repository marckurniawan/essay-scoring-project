import Link from "next/link";

import AppHeader from "@/components/AppHeader";
import StudentSubmissionAttempts from "@/components/student-submission-attempts";
import RoleGuard from "@/components/role-guard";

export default function StudentAttemptsPage() {
  return (
    <RoleGuard requiredRole="student">
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <AppHeader page="student" />
        <div className="mx-auto max-w-7xl space-y-6 px-5 py-7 sm:px-8 lg:py-9">
          <section className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Student workspace</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Semua pengerjaan</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Seluruh ujian yang kamu kerjakan, nilai akhirnya, jawaban yang terekam, detail skor per soal, dan feedback kriteria.
              </p>
            </div>
            <Link
              href="/student/history"
              className="inline-flex min-h-10 shrink-0 items-center justify-center border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
            >
              ← Ringkasan nilai
            </Link>
          </section>
          <StudentSubmissionAttempts />
          <footer className="border-t border-slate-200 pt-4 text-xs text-slate-500">Essay Scoring · All submissions</footer>
        </div>
      </main>
    </RoleGuard>
  );
}
