"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import AppHeader from "@/components/AppHeader";
import PageFooter from "@/components/PageFooter";
import PageHeader from "@/components/PageHeader";
import RoleGuard from "@/components/role-guard";
import {
  getCurrentUser,
  getMySubmissions,
  listExams,
  type AuthenticatedUser,
} from "@/lib/api";

export default function StudentHomePage() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [examCount, setExamCount] = useState<number | null>(null);
  const [submissionCount, setSubmissionCount] = useState<number | null>(null);

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

    getMySubmissions()
      .then((submissions) => {
        if (!cancelled) setSubmissionCount(submissions.length);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <RoleGuard requiredRole="student">
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <AppHeader page="student" />

        <div className="mx-auto max-w-7xl space-y-6 px-5 py-7 sm:px-8 lg:py-9">
          <PageHeader
            role="student"
            title={`Halo, ${user?.name ?? "Siswa"} 👋`}
            description="Kerjakan ujian yang tersedia, lihat hasil penilaian AI, dan pantau riwayat pengerjaanmu."
          />

          <div className="grid gap-5 sm:grid-cols-3">
            <Link
              href="/student/exams"
              className="group relative overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-r from-sky-700 to-teal-500 p-6 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg sm:col-span-1"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-orange-400/30 blur-2xl"
              />

              <p className="text-sm font-medium text-sky-100">
                Ujian tersedia
              </p>

              <p className="mt-2 text-4xl font-extrabold">
                {examCount ?? "–"}
              </p>

              <p className="mt-3 text-sm font-medium text-sky-100 group-hover:text-white">
                Mulai atau lanjutkan ujian →
              </p>
            </Link>

            <Link
              href="/student/history"
              className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-lg"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-teal-200/30 blur-2xl"
              />

              <p className="text-sm font-medium text-slate-500">
                Riwayat pengerjaan
              </p>

              <p className="mt-2 text-4xl font-extrabold text-slate-900">
                {submissionCount ?? "–"}
              </p>

              <p className="mt-3 text-sm font-medium text-slate-600 group-hover:text-orange-600">
                Lihat ringkasan &amp; feedback nilai →
              </p>
            </Link>

            <Link
              href="/student/attempts"
              className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-lg"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-teal-200/30 blur-2xl"
              />

              <p className="text-sm font-medium text-slate-500">
                Total pengerjaan
              </p>

              <p className="mt-2 text-4xl font-extrabold text-slate-900">
                →
              </p>

              <p className="mt-3 text-sm font-medium text-slate-600 group-hover:text-orange-600">
                Detail setiap percobaan ujian →
              </p>
            </Link>
          </div>

          <PageFooter role="student" />
        </div>
      </main>
    </RoleGuard>
  );
}
