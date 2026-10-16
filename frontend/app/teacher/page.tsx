"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import AppHeader from "@/components/AppHeader";
import PageFooter from "@/components/PageFooter";
import PageHeader from "@/components/PageHeader";
import RoleGuard from "@/components/role-guard";
import {
  getCurrentUser,
  getScoreProtests,
  listExams,
  type AuthenticatedUser,
} from "@/lib/api";

export default function TeacherHomePage() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [examCount, setExamCount] = useState<number | null>(null);
  const [pendingProtests, setPendingProtests] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then((current) => {
        if (!cancelled) setUser(current);
      })
      .catch(() => {});

    listExams()
      .then((exams) => {
        if (!cancelled) setExamCount(exams.length);
      })
      .catch(() => {});

    getScoreProtests()
      .then((protests) => {
        if (!cancelled) {
          setPendingProtests(
            protests.filter((p) => p.status === "pending").length,
          );
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <RoleGuard requiredRole="teacher">
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <AppHeader page="teacher" />

        <div className="mx-auto max-w-7xl space-y-6 px-5 py-7 sm:px-8 lg:py-9">
          <PageHeader
            role="teacher"
            title={`Halo, ${user?.name ?? "Guru"} 👋`}
            description="Kelola ujian, pantau hasil penilaian AI, dan tinjau protes nilai dari satu tempat."
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Link
              href="/teacher/exams"
              className="group relative overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-r from-sky-700 to-teal-500 p-6 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-orange-400/30 blur-2xl"
              />

              <p className="text-sm font-medium text-sky-100">
                Kelola ujian
              </p>

              <p className="mt-2 text-4xl font-extrabold">
                {examCount ?? "–"}
              </p>

              <p className="mt-3 text-sm font-medium text-sky-100 group-hover:text-white">
                Buat ujian baru, atur bobot soal &amp; rubrik →
              </p>
            </Link>

            <Link
              href="/teacher/protests"
              className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-lg"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-teal-200/30 blur-2xl"
              />

              <p className="text-sm font-medium text-slate-500">
                Protes nilai menunggu
              </p>

              <p className="mt-2 text-4xl font-extrabold text-slate-900">
                {pendingProtests ?? "–"}
              </p>

              <p className="mt-3 text-sm font-medium text-slate-600 group-hover:text-orange-600">
                Tinjau dan balas protes siswa →
              </p>
            </Link>
          </div>

          <PageFooter role="teacher" />
        </div>
      </main>
    </RoleGuard>
  );
}
