"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getMySubmissions, type SubmissionHistoryItem } from "@/lib/api";
import { formatDate } from "@/lib/formatDate";

function formatScore(score: number | null): string {
  return typeof score === "number" && Number.isFinite(score)
    ? score.toFixed(2)
    : "—";
}

export default function StudentSubmissionSummary() {
  const [submissions, setSubmissions] = useState<SubmissionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getMySubmissions()
      .then((data) => {
        if (active) setSubmissions(data);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Terjadi kesalahan saat mengambil ringkasan nilai.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(() => {
    const scores = submissions
      .filter(
        (submission) =>
          typeof submission.final_score === "number" &&
          Number.isFinite(submission.final_score),
      )
      .map((submission) => submission.final_score as number);

    return {
      total: submissions.length,
      scoredCount: scores.length,
      average:
        scores.length > 0
          ? scores.reduce((total, score) => total + score, 0) / scores.length
          : null,
      highest: scores.length > 0 ? Math.max(...scores) : null,
      pendingProtests: submissions.filter(
        (submission) => submission.score_protest?.status === "pending",
      ).length,
      recent: submissions.slice(0, 3),
    };
  }, [submissions]);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          Ringkasan hasil ujian
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
          Lihat performa keseluruhanmu. Buka total pengerjaan untuk melihat semua ujian,
          jawaban yang tersimpan, nilai, dan feedback secara terperinci.
        </p>
      </div>

      {error && (
        <p role="alert" className="border-l-4 border-red-600 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/student/attempts"
          className="group rounded-2xl border border-teal-200 bg-white p-4 transition-colors hover:border-sky-500 hover:bg-sky-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 sm:p-5"
          aria-label="Lihat semua pengerjaan ujian"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-slate-600">Total pengerjaan</p>
            <span aria-hidden="true" className="text-slate-400 transition-transform group-hover:translate-x-1">→</span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
            {loading ? "—" : summary.total}
          </p>
          <p className="mt-1 text-xs text-sky-700">Lihat semua pengerjaan</p>
        </Link>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <p className="text-sm text-slate-500">Rata-rata nilai</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
            {loading ? "—" : formatScore(summary.average)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {loading ? "Memuat data" : `${summary.scoredCount} pengerjaan sudah dinilai`}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <p className="text-sm text-slate-500">Nilai tertinggi</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
            {loading ? "—" : formatScore(summary.highest)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Dari ujian yang sudah dinilai</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <p className="text-sm text-slate-500">Protes menunggu</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
            {loading ? "—" : summary.pendingProtests}
          </p>
          <p className="mt-1 text-xs text-slate-500">Menunggu peninjauan Teacher</p>
        </article>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-950">Pengerjaan terbaru</h3>
            <p className="mt-1 text-sm text-slate-500">Ringkasan singkat dari ujian terakhirmu.</p>
          </div>
          <Link href="/student/attempts" className="text-sm font-semibold text-sky-700 underline-offset-4 hover:underline">
            Lihat semua
          </Link>
        </div>

        {loading ? (
          <p role="status" className="mt-4 text-sm text-slate-500">Memuat riwayat...</p>
        ) : summary.recent.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Belum ada ujian yang dikerjakan.</p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {summary.recent.map((submission) => (
              <div key={submission.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {submission.exam_title ?? `Ujian #${submission.exam_id}`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(submission.created_at)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                  {formatScore(submission.final_score)} <span className="font-normal text-slate-500">/ 100</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
