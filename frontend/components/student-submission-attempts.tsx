"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  createScoreProtest,
  getMySubmissions,
  type SubmissionHistoryItem,
  type SubmissionHistoryCriterion,
} from "@/lib/api";

function formatDate(value: string | null | undefined): string {
  if (!value) return "Tanggal tidak tersedia";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatScore(score: number | null | undefined): string {
  return typeof score === "number" && Number.isFinite(score)
    ? score.toFixed(2)
    : "—";
}

function protestStatusLabel(status: string | undefined): string {
  if (status === "pending") return "Menunggu review";
  if (status === "accepted") return "Protes diterima";
  if (status === "rejected") return "Protes ditolak";
  return "";
}

function protestStatusClass(status: string | undefined): string {
  if (status === "pending") return "bg-amber-50 text-amber-800";
  if (status === "accepted") return "bg-emerald-50 text-emerald-800";
  return "bg-red-50 text-red-800";
}

function renderCriterion(criterion: SubmissionHistoryCriterion, index: number) {
  return (
    <article
      key={`${criterion.criterion_id ?? "criterion"}-${index}`}
      className="border border-slate-200 bg-slate-50 p-3.5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h6 className="font-medium text-slate-900">
          {criterion.criterion_label ?? `Kriteria ${index + 1}`}
        </h6>
        <span className="text-sm font-semibold tabular-nums text-slate-900">
          {typeof criterion.score === "number" ? `${formatScore(criterion.score)}/100` : "—"}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
        {criterion.reasoning ?? "Feedback belum tersedia."}
      </p>
      <p className="mt-2 text-xs text-slate-500">
        {criterion.included === false
          ? "Tidak dihitung dalam nilai akhir"
          : `Bobot kriteria: ${criterion.weight ?? "—"}`}
      </p>
    </article>
  );
}

export default function StudentSubmissionAttempts() {
  const [submissions, setSubmissions] = useState<SubmissionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState<Record<number, boolean>>({});
  const [protestErrors, setProtestErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    let active = true;
    getMySubmissions()
      .then((data) => {
        if (active) setSubmissions(data);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Gagal memuat riwayat pengerjaan.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredSubmissions = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("id-ID");
    if (!query) return submissions;
    return submissions.filter((submission) => {
      const content = [
        submission.exam_title ?? `Exam #${submission.exam_id}`,
        submission.student_answer,
        ...(submission.question_results ?? []).flatMap((question) => [
          question.question,
          question.student_answer,
        ]),
      ].join(" ").toLocaleLowerCase("id-ID");
      return content.includes(query);
    });
  }, [searchQuery, submissions]);

  async function handleProtestSubmit(
    event: FormEvent<HTMLFormElement>,
    submissionId: number,
  ) {
    event.preventDefault();
    const reason = (reasons[submissionId] ?? "").trim();
    if (reason.length < 10) {
      setProtestErrors((current) => ({
        ...current,
        [submissionId]: "Alasan harus terdiri dari minimal 10 karakter.",
      }));
      return;
    }

    setSubmitting((current) => ({ ...current, [submissionId]: true }));
    setProtestErrors((current) => ({ ...current, [submissionId]: "" }));

    try {
      const protest = await createScoreProtest(submissionId, { reason });
      setSubmissions((current) => current.map((submission) =>
        submission.id === submissionId
          ? { ...submission, score_protest: protest }
          : submission,
      ));
      setReasons((current) => ({ ...current, [submissionId]: "" }));
    } catch (err: unknown) {
      setProtestErrors((current) => ({
        ...current,
        [submissionId]: err instanceof Error
          ? err.message
          : "Gagal mengajukan protes. Silakan coba lagi.",
      }));
    } finally {
      setSubmitting((current) => ({ ...current, [submissionId]: false }));
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="min-w-0 flex-1">
          <label htmlFor="submission-search" className="sr-only">Cari riwayat ujian</label>
          <input
            id="submission-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Cari berdasarkan nama ujian, pertanyaan, atau jawaban..."
            className="min-h-11 w-full border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="flex items-center text-sm text-slate-500">
          {loading ? "Memuat..." : `${filteredSubmissions.length} dari ${submissions.length} pengerjaan`}
        </div>
      </div>

      {error && (
        <p role="alert" className="border-l-4 border-red-600 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      )}

      {loading && <p role="status" className="text-sm text-slate-500">Memuat daftar pengerjaan...</p>}

      {!loading && !error && submissions.length === 0 && (
        <div className="border border-dashed border-slate-300 bg-white p-6">
          <p className="font-medium text-slate-900">Belum ada pengerjaan</p>
          <p className="mt-1 text-sm text-slate-500">Ujian yang kamu mulai atau selesaikan akan muncul di sini.</p>
        </div>
      )}

      {!loading && !error && submissions.length > 0 && filteredSubmissions.length === 0 && (
        <div className="border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Tidak ada pengerjaan yang sesuai dengan pencarian.
        </div>
      )}

      <div className="space-y-3">
        {filteredSubmissions.map((submission) => {
          const protest = submission.score_protest ?? null;
          const statusLabel = protestStatusLabel(protest?.status);
          const questionResults = submission.question_results ?? [];
          const reasonsValue = reasons[submission.id] ?? "";
          const isSubmitting = submitting[submission.id] ?? false;
          const protestError = protestErrors[submission.id];
          const submissionStatus = submission.status === "in_progress"
            ? "Sedang dikerjakan"
            : submission.status === "expired"
              ? "Waktu habis"
              : typeof submission.final_score === "number"
                ? "Selesai dinilai"
                : "Belum dinilai";
          const submissionStatusClass = submission.status === "in_progress"
            ? "bg-blue-50 text-blue-800"
            : submission.status === "expired"
              ? "bg-amber-50 text-amber-800"
              : typeof submission.final_score === "number"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-slate-100 text-slate-700";

          return (
            <details key={submission.id} className="group border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 sm:p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="break-words font-semibold text-slate-950">
                      {submission.exam_title ?? `Exam #${submission.exam_id}`}
                    </h3>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium ${submissionStatusClass}`}>
                      {submissionStatus}
                    </span>
                    {protest && (
                      <span className={`inline-flex px-2 py-1 text-xs font-medium ${protestStatusClass(protest.status)}`}>
                        {statusLabel}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Pengerjaan #{submission.id} · {formatDate(submission.created_at)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {submission.duration_minutes ? `Durasi ujian: ${submission.duration_minutes} menit · ` : ""}
                    {questionResults.length > 0
                      ? `${questionResults.length} soal`
                      : "Format riwayat klasik"}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-xl font-semibold tabular-nums text-slate-950">
                    {formatScore(submission.final_score)}
                  </p>
                  <p className="text-xs text-slate-500">Nilai akhir / 100</p>
                  {protest?.status === "accepted" && typeof protest.reviewed_score === "number" && (
                    <p className="mt-1 text-sm font-semibold text-emerald-700">
                      Review: {protest.reviewed_score.toFixed(2)}
                    </p>
                  )}
                  <span className="mt-2 block text-xs font-semibold text-blue-700 group-open:hidden">Show details +</span>
                  <span className="mt-2 hidden text-xs font-semibold text-blue-700 group-open:block">Hide details −</span>
                </div>
              </summary>

              <div className="space-y-5 border-t border-slate-200 p-4 sm:p-5">
                <section>
                  <h4 className="text-sm font-semibold text-slate-900">Informasi pengerjaan</h4>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="bg-slate-50 p-3">
                      <dt className="text-xs text-slate-500">Exam ID</dt>
                      <dd className="mt-1 text-sm font-medium text-slate-900">{submission.exam_id}</dd>
                    </div>
                    <div className="bg-slate-50 p-3">
                      <dt className="text-xs text-slate-500">Mulai</dt>
                      <dd className="mt-1 text-sm font-medium text-slate-900">{formatDate(submission.started_at)}</dd>
                    </div>
                    <div className="bg-slate-50 p-3">
                      <dt className="text-xs text-slate-500">Submit / selesai</dt>
                      <dd className="mt-1 text-sm font-medium text-slate-900">{formatDate(submission.submitted_at ?? submission.created_at)}</dd>
                    </div>
                  </dl>
                </section>

                {questionResults.length > 0 ? (
                  <section>
                    <h4 className="text-sm font-semibold text-slate-900">Jawaban dan hasil per soal</h4>
                    <div className="mt-3 space-y-4">
                      {questionResults.map((question, index) => (
                        <article key={question.question_submission_id ?? question.question_id} className="border border-slate-200">
                          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 p-4">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                                Soal {index + 1} · Bobot {question.weight}
                              </p>
                              <h5 className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-900">
                                {question.question}
                              </h5>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-xl font-semibold tabular-nums text-slate-950">
                                {formatScore(question.question_score)}
                              </p>
                              <p className="text-xs text-slate-500">Nilai soal / 100</p>
                            </div>
                          </div>

                          <div className="space-y-4 p-4">
                            <div>
                              <h6 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Jawaban yang tersimpan</h6>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                {question.student_answer?.trim() || "Tidak ada jawaban yang tersimpan untuk soal ini."}
                              </p>
                            </div>
                            <div>
                              <h6 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Feedback per kriteria</h6>
                              {question.criterion_results.length === 0 ? (
                                <p className="mt-2 text-sm text-slate-500">Feedback kriteria belum tersedia.</p>
                              ) : (
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  {question.criterion_results.map(renderCriterion)}
                                </div>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : (
                  <section>
                    <h4 className="text-sm font-semibold text-slate-900">Jawaban yang tersimpan</h4>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {submission.student_answer?.trim() || "Tidak ada jawaban yang tersimpan."}
                    </p>
                    <h4 className="mt-5 text-sm font-semibold text-slate-900">Hasil per kriteria</h4>
                    {submission.criterion_results.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-500">Detail penilaian belum tersedia.</p>
                    ) : (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {submission.criterion_results.map(renderCriterion)}
                      </div>
                    )}
                  </section>
                )}

                <section className="border-t border-slate-200 pt-4">
                  <h4 className="text-sm font-semibold text-slate-900">Protes nilai</h4>
                  {protest ? (
                    <div className="mt-3 space-y-3 border border-slate-200 p-4">
                      <div>
                        <p className="text-xs font-medium text-slate-500">Status</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{statusLabel}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">Alasan protes</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{protest.reason}</p>
                      </div>
                      {typeof protest.original_score === "number" && (
                        <div>
                          <p className="text-xs font-medium text-slate-500">Nilai sebelum review</p>
                          <p className="mt-1 text-sm text-slate-700">{protest.original_score.toFixed(2)}</p>
                        </div>
                      )}
                      {typeof protest.reviewed_score === "number" && (
                        <div>
                          <p className="text-xs font-medium text-slate-500">Nilai setelah review</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{protest.reviewed_score.toFixed(2)}</p>
                        </div>
                      )}
                      {protest.teacher_feedback && (
                        <div>
                          <p className="text-xs font-medium text-slate-500">Feedback Teacher</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{protest.teacher_feedback}</p>
                        </div>
                      )}
                    </div>
                  ) : submission.final_score === null || submission.status === "in_progress" ? (
                    <p className="mt-2 text-sm text-slate-500">Protes dapat diajukan setelah penilaian selesai.</p>
                  ) : (
                    <form className="mt-3 space-y-3" onSubmit={(event) => void handleProtestSubmit(event, submission.id)}>
                      <p className="text-sm leading-6 text-slate-600">
                        Merasa penilaian belum sesuai? Jelaskan bagian jawaban yang menurutmu perlu ditinjau kembali.
                      </p>
                      <textarea
                        value={reasonsValue}
                        onChange={(event) => setReasons((current) => ({ ...current, [submission.id]: event.target.value }))}
                        minLength={10}
                        maxLength={3000}
                        rows={4}
                        required
                        disabled={isSubmitting}
                        placeholder="Tuliskan alasan protes dengan jelas..."
                        className="w-full border border-slate-300 px-3 py-2 text-sm leading-6 text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-slate-500">Minimal 10, maksimal 3000 karakter.</p>
                        <button
                          type="submit"
                          disabled={isSubmitting || reasonsValue.trim().length < 10}
                          className="min-h-10 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSubmitting ? "Mengirim..." : "Ajukan protes"}
                        </button>
                      </div>
                      {protestError && (
                        <p role="alert" className="border border-red-200 p-3 text-sm text-red-700">{protestError}</p>
                      )}
                    </form>
                  )}
                </section>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
