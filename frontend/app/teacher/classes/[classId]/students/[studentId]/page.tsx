
"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import AppHeader from "@/components/AppHeader";
import PageFooter from "@/components/PageFooter";
import PageHeader from "@/components/PageHeader";
import RoleGuard from "@/components/role-guard";
import { buttonClass } from "@/components/ui/button";
import { formatDate } from "@/lib/formatDate";
import {
  getStudentPerformance,
  type StudentPerformance,
  type SubmissionHistoryItem,
} from "@/lib/api";

function scoreLabel(score: number | null | undefined): string {
  return score === null || score === undefined
    ? "Belum dinilai"
    : `${score.toFixed(2)}/100`;
}

function statusLabel(status: string | undefined): string {
  if (status === "graded") return "Selesai dinilai";
  if (status === "in_progress") return "Sedang dikerjakan";
  if (status === "expired") return "Waktu habis";
  return status ?? "Status tidak tersedia";
}

function AttemptCard({ attempt }: { attempt: SubmissionHistoryItem }) {
  const questions = attempt.question_results ?? [];
  const legacyCriteria = attempt.criterion_results ?? [];
  const protest = attempt.score_protest;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
            Pengerjaan #{attempt.id}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">
            {attempt.exam_title ?? `Ujian #${attempt.exam_id}`}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Dikumpulkan: {formatDate(attempt.submitted_at ?? attempt.created_at)}
          </p>
          <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
            {statusLabel(attempt.status)}
          </span>
        </div>

        <div className="sm:text-right">
          <p className="text-sm text-slate-500">Nilai akhir</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">
            {scoreLabel(attempt.final_score)}
          </p>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {questions.length > 0 ? (
          questions.map((question, index) => (
            <section
              key={question.question_submission_id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h4 className="font-semibold text-slate-900">
                  Soal {index + 1}: {question.question}
                </h4>
                <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold tabular-nums">
                  {scoreLabel(question.question_score)}
                </span>
              </div>

              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Jawaban siswa
              </p>
              <div className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                {question.student_answer || "Tidak ada jawaban."}
              </div>

              {question.criterion_results.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h5 className="text-sm font-semibold text-slate-800">
                    Hasil tiap kriteria
                  </h5>
                  {question.criterion_results.map(
                    (criterion, criterionIndex) => (
                      <div
                        key={`${question.question_submission_id}-${criterion.criterion_id ?? criterionIndex}`}
                        className="rounded-lg border border-slate-100 p-3"
                      >
                        <div className="flex flex-wrap justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900">
                            {criterion.criterion_label ??
                              `Kriteria ${criterionIndex + 1}`}
                          </p>
                          <p className="text-sm font-semibold tabular-nums">
                            {scoreLabel(criterion.score)}
                          </p>
                        </div>
                        {criterion.reasoning && (
                          <p className="mt-1 text-sm leading-5 text-slate-600">
                            {criterion.reasoning}
                          </p>
                        )}
                      </div>
                    ),
                  )}
                </div>
              )}
            </section>
          ))
        ) : attempt.student_answer ? (
          <section className="rounded-xl border border-slate-200 p-4">
            <h4 className="font-semibold text-slate-900">Jawaban siswa</h4>
            <div className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              {attempt.student_answer}
            </div>
          </section>
        ) : null}

        {questions.length === 0 && legacyCriteria.length > 0 && (
          <section className="space-y-2">
            <h4 className="font-semibold text-slate-900">Hasil kriteria</h4>
            {legacyCriteria.map((criterion, index) => (
              <div
                key={`${criterion.criterion_id ?? index}`}
                className="rounded-lg border border-slate-200 p-3"
              >
                <div className="flex justify-between gap-3">
                  <p className="text-sm font-medium">
                    {criterion.criterion_label ?? `Kriteria ${index + 1}`}
                  </p>
                  <p className="text-sm font-semibold tabular-nums">
                    {scoreLabel(criterion.score)}
                  </p>
                </div>
                {criterion.reasoning && (
                  <p className="mt-1 text-sm text-slate-600">
                    {criterion.reasoning}
                  </p>
                )}
              </div>
            ))}
          </section>
        )}

        {protest && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-amber-950">Protes nilai</h4>
              <span className="rounded-full border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-900">
                {protest.status === "pending"
                  ? "Menunggu"
                  : protest.status === "accepted"
                    ? "Diterima"
                    : "Ditolak"}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-950">
              {protest.reason}
            </p>
            {protest.teacher_feedback && (
              <p className="mt-2 text-sm leading-6 text-amber-900">
                Tanggapan guru: {protest.teacher_feedback}
              </p>
            )}
          </section>
        )}
      </div>
    </article>
  );
}

function StudentPerformanceContent() {
  const params = useParams<{
    classId: string;
    studentId: string;
  }>();

  const classId = Number(params.classId);
  const studentId = Number(params.studentId);

  const isValidRoute =
    Number.isInteger(classId) &&
    classId > 0 &&
    Number.isInteger(studentId) &&
    studentId > 0;

  const [performance, setPerformance] = useState<StudentPerformance | null>(
    null,
  );
  const [loading, setLoading] = useState(isValidRoute);
  const [error, setError] = useState("");

    useEffect(() => {
    if (!isValidRoute) return;

    let cancelled = false;

    async function fetchPerformance() {
        try {
        const result = await getStudentPerformance(classId, studentId);

        if (cancelled) return;

        setPerformance(result);
        setError("");
        } catch (err) {
        if (cancelled) return;

        setError(
            err instanceof Error
            ? err.message
            : "Tidak dapat memuat performa siswa.",
        );
        } finally {
        if (!cancelled) {
            setLoading(false);
        }
        }
    }

    void fetchPerformance();

    return () => {
        cancelled = true;
    };
    }, [classId, studentId, isValidRoute]);

  const displayedError = isValidRoute
    ? error
    : "Alamat siswa atau kelas tidak valid.";

  const currentPerformance =
    performance?.class_id === classId &&
    performance.student.id === studentId
      ? performance
      : null;

  return (
    <RoleGuard requiredRole="teacher">
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <AppHeader page="teacher" />

        <div className="mx-auto max-w-7xl space-y-6 px-5 py-7 sm:px-8 lg:py-9">
          <PageHeader
            role="teacher"
            title={currentPerformance?.student.name ?? "Performa siswa"}
            description={
              currentPerformance
                ? `${currentPerformance.student.email} · ${currentPerformance.class_name}`
                : "Detail nilai dan riwayat pengerjaan siswa."
            }
            backHref={`/teacher/classes/${classId}`}
            backLabel="← Kembali ke kelas"
          />

          {displayedError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {displayedError}
            </div>
          )}

          {loading ? (
            <div
              role="status"
              className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500"
            >
              Memuat performa siswa...
            </div>
          ) : currentPerformance ? (
            <>
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: "Rata-rata nilai",
                    value: scoreLabel(currentPerformance.average_score),
                  },
                  {
                    label: "Ujian selesai",
                    value: currentPerformance.completed_exams,
                  },
                  {
                    label: "Total pengerjaan",
                    value: currentPerformance.total_attempts,
                  },
                  {
                    label: "Protes nilai",
                    value: currentPerformance.attempts.filter(
                      (attempt) =>
                        attempt.score_protest !== null &&
                        attempt.score_protest !== undefined,
                    ).length,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-200 bg-white p-5"
                  >
                    <p className="text-sm text-slate-500">{item.label}</p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
                      {item.value}
                    </p>
                  </div>
                ))}
              </section>

              <section className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                    Riwayat ujian
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Setiap pengerjaan menampilkan jawaban, hasil kriteria,
                    umpan balik AI, dan protes terkait jika ada.
                  </p>
                </div>

                {currentPerformance.attempts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                    <p className="font-semibold text-slate-900">
                      Belum ada pengerjaan
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Riwayat siswa akan muncul setelah ia mulai mengerjakan
                      ujian di kelas ini.
                    </p>
                  </div>
                ) : (
                  currentPerformance.attempts.map((attempt) => (
                    <AttemptCard key={attempt.id} attempt={attempt} />
                  ))
                )}
              </section>

              <div>
                <Link
                  href={`/teacher/classes/${classId}`}
                  className={buttonClass("secondary", "px-4 py-2")}
                >
                  Kembali ke detail kelas
                </Link>
              </div>
            </>
          ) : null}

          <PageFooter role="teacher" />
        </div>
      </main>
    </RoleGuard>
  );
}

export default function StudentPerformancePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-600">
          Memuat performa siswa...
        </main>
      }
    >
      <StudentPerformanceContent />
    </Suspense>
  );
}
