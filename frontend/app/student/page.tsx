"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import AppHeader from "@/components/AppHeader";
import {
  gradeSubmission,
  listExams,
  type Exam,
  type GradingResult,
} from "@/lib/api";

function formatDate(value: string | null): string {
  if (!value) return "Tanggal tidak tersedia";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak tersedia";

  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
}

export default function StudentPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [studentAnswer, setStudentAnswer] = useState("");
  const [result, setResult] = useState<GradingResult | null>(null);
  const [loadingExams, setLoadingExams] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    listExams()
      .then((data) => {
        if (cancelled) return;
        setExams(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Tidak dapat memuat daftar exam.");
      })
      .finally(() => {
        if (!cancelled) setLoadingExams(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredExams = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("id-ID");
    if (!query) return exams;

    return exams.filter((exam) => {
      const searchableText = [
        exam.title,
        exam.question,
        ...exam.criteria.flatMap((criterion) => [criterion.label, criterion.description]),
      ]
        .join(" ")
        .toLocaleLowerCase("id-ID");
      return searchableText.includes(query);
    });
  }, [exams, searchQuery]);

  const selectedExam = exams.find((exam) => String(exam.id) === selectedExamId);
  const activeCriteriaCount = selectedExam?.criteria.filter((criterion) => criterion.weight > 0).length ?? 0;
  const totalActiveWeight = selectedExam?.criteria.reduce(
    (sum, criterion) => sum + (criterion.weight > 0 ? criterion.weight : 0),
    0,
  ) ?? 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedExam || !studentAnswer.trim()) {
      setError("Pilih exam dan tuliskan jawaban essay terlebih dahulu.");
      return;
    }

    setError("");
    setResult(null);
    setSubmitting(true);

    try {
      const gradingResult = await gradeSubmission(selectedExam.id, studentAnswer.trim());
      setResult(gradingResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Penilaian gagal. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  function openExam(examId: string) {
    setSelectedExamId(examId);
    setStudentAnswer("");
    setResult(null);
    setError("");
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader page="student" />

      <div className="mx-auto max-w-7xl space-y-7 px-5 py-7 sm:px-8 lg:py-9">
        <section className="border-b border-slate-200 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Student workspace</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Choose an assessment</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Cari soal yang ingin dikerjakan. Detail pertanyaan, area jawaban, dan hasil penilaian akan ditampilkan setelah kamu memilih exam.
          </p>
        </section>

        {error && (
          <div role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span className="font-semibold">Penilaian belum berhasil.</span> {error}
          </div>
        )}

        {loadingExams ? (
          <div role="status" className="border-y border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500">Memuat assessment…</div>
        ) : exams.length === 0 ? (
          <section className="border-y border-slate-200 bg-white px-5 py-10 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">No assessment available</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Belum ada exam untuk dikerjakan</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Guru perlu membuat exam terlebih dahulu. Setelah tersedia, exam akan muncul di halaman ini.</p>
            <a href="/teacher" className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2">Buka Teacher Dashboard →</a>
          </section>
        ) : (
          <div className="grid items-start gap-7 lg:grid-cols-[minmax(270px,0.78fr)_minmax(0,1.55fr)]">
            <aside className="min-w-0">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-950">Available exams</h2>
                <span className="text-xs tabular-nums text-slate-500">{filteredExams.length} of {exams.length}</span>
              </div>

              <div className="mb-3 flex gap-2">
                <label htmlFor="student-exam-search" className="sr-only">Search exams</label>
                <input
                  id="student-exam-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search exams…"
                  className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear exam search"
                    className="rounded-lg px-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                  >
                    Clear
                  </button>
                )}
              </div>

              {filteredExams.length === 0 ? (
                <div className="border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-900">Tidak ada exam yang cocok</p>
                  <p className="mt-1 text-sm leading-5 text-slate-600">Coba kata kunci lain.</p>
                </div>
              ) : (
                <div className="space-y-2 lg:max-h-[680px] lg:overflow-y-auto lg:pr-1">
                  {filteredExams.map((exam) => {
                    const isSelected = selectedExamId === String(exam.id);
                    return (
                      <article key={exam.id} className={`border bg-white transition-colors ${isSelected ? "border-blue-700 ring-1 ring-blue-700" : "border-slate-200 hover:border-slate-400"}`}>
                        <button
                          type="button"
                          onClick={() => openExam(String(exam.id))}
                          aria-pressed={isSelected}
                          className="block w-full p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-700"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Exam #{exam.id}</p>
                              <h3 className="mt-1 break-words text-sm font-semibold leading-5 text-slate-950">{exam.title}</h3>
                            </div>
                            <span className={`mt-1 shrink-0 text-sm ${isSelected ? "font-semibold text-blue-700" : "text-slate-400"}`} aria-hidden="true">
                              {isSelected ? "●" : "→"}
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{exam.question}</p>
                          <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                            <span>{formatDate(exam.created_at)}</span>
                            <span className={isSelected ? "font-semibold text-blue-700" : "font-medium"}>{isSelected ? "Opened" : "View details"}</span>
                          </div>
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
              <p className="mt-3 text-xs leading-5 text-slate-500">Pilih satu exam untuk melihat instruksi dan membuka form jawaban.</p>
            </aside>

            <section className="min-w-0">
              {!selectedExam ? (
                <div className="flex min-h-72 flex-col items-center justify-center border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                  <div className="flex size-10 items-center justify-center border border-slate-200 text-lg text-slate-500" aria-hidden="true">↖</div>
                  <h2 className="mt-4 text-lg font-semibold text-slate-950">Pilih exam untuk memulai</h2>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">Pertanyaan lengkap dan editor jawaban akan muncul di area ini setelah kamu memilih assessment di sebelah kiri.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <section className="border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Exam #{selectedExam.id}</p>
                      <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{selectedExam.title}</h2>
                      <p className="mt-1 text-xs text-slate-500">Created {formatDate(selectedExam.created_at)}</p>
                    </div>

                    <div className="px-5 py-5 sm:px-6">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Question</h3>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-800">{selectedExam.question}</p>
                    </div>

                    <div className="grid grid-cols-3 border-t border-slate-200 bg-slate-50/70">
                      <div className="border-r border-slate-200 px-4 py-3 sm:px-5">
                        <p className="text-[11px] text-slate-500 sm:text-xs">Rubric criteria</p>
                        <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950">{selectedExam.criteria.length}</p>
                      </div>
                      <div className="border-r border-slate-200 px-4 py-3 sm:px-5">
                        <p className="text-[11px] text-slate-500 sm:text-xs">Active criteria</p>
                        <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950">{activeCriteriaCount}</p>
                      </div>
                      <div className="px-4 py-3 sm:px-5">
                        <p className="text-[11px] text-slate-500 sm:text-xs">Active weight</p>
                        <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950">{Number(totalActiveWeight.toFixed(2))}</p>
                      </div>
                    </div>
                    <p className="px-5 py-3 text-xs leading-5 text-slate-500 sm:px-6">Kriteria berbobot nol tetap dapat memberikan feedback, tetapi tidak masuk ke perhitungan nilai akhir.</p>
                  </section>

                  <section className="border border-slate-200 bg-white p-5 sm:p-6">
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <label htmlFor="student-answer" className="text-sm font-semibold text-slate-900">Your answer</label>
                          <span className="text-xs tabular-nums text-slate-500">{studentAnswer.length.toLocaleString("id-ID")} characters</span>
                        </div>
                        <textarea
                          id="student-answer"
                          value={studentAnswer}
                          onChange={(event) => {
                            setStudentAnswer(event.target.value);
                            setResult(null);
                            setError("");
                          }}
                          required
                          minLength={1}
                          rows={12}
                          placeholder="Tuliskan jawabanmu secara lengkap. Jelaskan konsep, uraikan alasan, dan berikan contoh yang relevan…"
                          className="mt-2 min-h-[260px] w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3.5 text-sm leading-7 outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                        />
                        <p className="mt-2 text-xs leading-5 text-slate-500">Sebelum mengirim, pastikan jawabanmu sudah mencakup bagian-bagian yang diminta soal.</p>
                      </div>

                      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="max-w-sm text-xs leading-5 text-slate-500">Hasil penilaian mencakup skor dan feedback untuk setiap kriteria.</p>
                        <button
                          type="submit"
                          disabled={submitting || !studentAnswer.trim()}
                          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          {submitting ? "Assessing answer…" : "Submit essay for assessment"}
                        </button>
                      </div>
                    </form>
                  </section>

                  {result && (
                    <section aria-live="polite" className="border border-slate-200 bg-white">
                      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:px-6">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Assessment completed</p>
                          <h2 className="mt-1 text-lg font-semibold text-slate-950">Grading report</h2>
                          <p className="mt-1 text-xs text-slate-500">Submission #{result.submission_id}</p>
                        </div>
                        <div className="sm:text-right">
                          <p className="text-xs text-slate-500">Final score</p>
                          <p className="mt-0.5 text-3xl font-semibold tracking-tight text-slate-950 tabular-nums">{result.final_score.toFixed(2)}<span className="ml-1 text-sm font-normal text-slate-500">/ 100</span></p>
                        </div>
                      </div>

                      <div className="grid gap-0 md:grid-cols-2 md:divide-x md:divide-slate-200">
                        {result.criterion_results.map((criterion, index) => (
                          <article key={criterion.criterion_id} className={`flex min-w-0 flex-col p-5 sm:p-6 ${index > 1 ? "border-t border-slate-200" : index > 0 ? "border-t border-slate-200 md:border-t-0" : ""} ${index % 2 === 0 ? "md:border-r md:border-slate-200" : ""}`}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <h3 className="text-sm font-semibold text-slate-950">{criterion.label}</h3>
                                <p className={`mt-1 text-xs font-medium ${criterion.satisfied ? "text-emerald-800" : "text-amber-800"}`}>
                                  {criterion.satisfied ? "Criterion met" : "Needs improvement"}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-2xl font-semibold tracking-tight text-slate-950 tabular-nums">{criterion.score}</p>
                                <p className="text-xs text-slate-500">/ 100</p>
                              </div>
                            </div>

                            <p className="mt-4 flex-1 text-sm leading-6 text-slate-700">{criterion.reasoning}</p>

                            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`Score for ${criterion.label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={criterion.score}>
                              <div className="h-full bg-blue-700" style={{ width: `${Math.min(100, Math.max(0, criterion.score))}%` }} />
                            </div>

                            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
                              <span className="text-slate-500">Weight {criterion.weight}</span>
                              {criterion.included_in_final_score ? (
                                <span className="font-medium text-slate-600">Included in final score</span>
                              ) : (
                                <span className="font-medium text-amber-800">Feedback only · weight 0</span>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>

                      <p className="border-t border-slate-200 px-5 py-3 text-xs leading-5 text-slate-500 sm:px-6">
                        Hasil AI membantu proses belajar. Gunakan feedback tiap kriteria untuk memahami aspek jawaban yang sudah kuat dan yang masih perlu dikembangkan.
                      </p>
                    </section>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        <footer className="border-t border-slate-200 pt-4 text-xs text-slate-500">Essay Scoring · Student workspace</footer>
      </div>
    </main>
  );
}
