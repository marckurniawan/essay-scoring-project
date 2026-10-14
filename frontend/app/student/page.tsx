
"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

import {
  gradeSubmission,
  listExams,
  type Exam,
  type GradingResult,
} from "@/lib/api";

export default function StudentPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [studentAnswer, setStudentAnswer] = useState("");
  const [result, setResult] = useState<GradingResult | null>(null);

  const [loadingExams, setLoadingExams] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    listExams()
      .then((data) => {
        if (cancelled) return;

        setExams(data);
        setSelectedExamId(data.length > 0 ? String(data[0].id) : "");
      })
      .catch((err: unknown) => {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "Tidak dapat memuat daftar exam.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingExams(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedExam = exams.find(
    (exam) => String(exam.id) === selectedExamId,
  );

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
      const gradingResult = await gradeSubmission(
        selectedExam.id,
        studentAnswer.trim(),
      );

      setResult(gradingResult);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Penilaian gagal. Silakan coba lagi.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleExamChange(examId: string) {
    setSelectedExamId(examId);
    setStudentAnswer("");
    setResult(null);
    setError("");
  }

  const activeCriteriaCount =
    selectedExam?.criteria.filter((criterion) => criterion.weight > 0)
      .length ?? 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div>
            <p className="text-sm font-semibold tracking-wide text-blue-700">
              ESSAY SCORING
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Student Portal
            </h1>
          </div>

          <Link
            href="/teacher"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold transition hover:bg-slate-100"
          >
            Teacher Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:px-8">
        <section>
          <p className="text-sm font-semibold text-blue-700">
            ESSAY ASSESSMENT
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">
            Tunjukkan pemahamanmu
          </h2>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            Pilih exam, baca pertanyaannya dengan saksama, lalu tuliskan
            jawabanmu. AI akan mengevaluasi jawaban berdasarkan rubric
            yang ditetapkan oleh guru dan memberikan feedback per kriteria.
          </p>
        </section>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <strong>Terjadi kesalahan:</strong> {error}
          </div>
        )}

        {loadingExams ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            Memuat daftar exam...
          </div>
        ) : exams.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <h3 className="text-lg font-semibold">Belum ada exam tersedia</h3>
            <p className="mt-2 text-sm text-slate-600">
              Guru perlu membuat exam terlebih dahulu sebelum siswa dapat
              mengirim jawaban.
            </p>
            <Link
              href="/teacher"
              className="mt-5 inline-flex rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Buka Teacher Dashboard
            </Link>
          </section>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label
                    htmlFor="exam-select"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Pilih exam
                  </label>

                  <select
                    id="exam-select"
                    value={selectedExamId}
                    onChange={(event) =>
                      handleExamChange(event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {exams.map((exam) => (
                      <option key={exam.id} value={exam.id}>
                        {exam.title}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedExam && (
                  <>
                    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                        Exam #{selectedExam.id}
                      </p>

                      <h3 className="mt-2 text-xl font-bold">
                        {selectedExam.title}
                      </h3>

                      <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-700">
                        {selectedExam.question}
                      </p>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label
                          htmlFor="student-answer"
                          className="text-sm font-semibold"
                        >
                          Jawaban essay kamu
                        </label>

                        <span className="text-xs text-slate-500">
                          {studentAnswer.trim().length} karakter
                        </span>
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
                        placeholder="Tuliskan jawabanmu di sini. Jelaskan konsep, berikan contoh yang relevan, dan uraikan alasanmu..."
                        className="w-full resize-y rounded-xl border border-slate-300 px-4 py-4 leading-7 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />

                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        Jawaban akan dinilai oleh AI berdasarkan pertanyaan
                        dan rubric exam yang dipilih.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting || !studentAnswer.trim()}
                      className="w-full rounded-xl bg-blue-700 px-5 py-3.5 font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting
                        ? "Sedang menilai jawaban..."
                        : "Submit dan nilai essay"}
                    </button>
                  </>
                )}
              </form>
            </section>

            <aside className="space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-bold">Tentang penilaian</h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Setiap jawaban dievaluasi berdasarkan kriteria yang
                  ditentukan guru, bukan dengan membandingkan jawabanmu
                  terhadap satu kalimat jawaban baku.
                </p>

                {selectedExam && (
                  <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-600">
                        Total kriteria
                      </span>
                      <span className="font-semibold">
                        {selectedExam.criteria.length}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-600">
                        Kriteria berbobot aktif
                      </span>
                      <span className="font-semibold">
                        {activeCriteriaCount}
                      </span>
                    </div>
                  </div>
                )}
              </section>

              {result && (
                <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-emerald-700">
                    PENILAIAN SELESAI
                  </p>

                  <p className="mt-3 text-sm text-slate-600">
                    Nilai akhir kamu
                  </p>

                  <p className="mt-1 text-5xl font-bold tabular-nums tracking-tight">
                    {result.final_score.toFixed(2)}
                    <span className="ml-1 text-lg font-medium text-slate-400">
                      / 100
                    </span>
                  </p>

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Baca feedback setiap kriteria di bawah untuk memahami
                    bagian jawaban yang sudah kuat dan bagian yang perlu
                    dikembangkan.
                  </p>

                  <a
                    href="#grading-results"
                    className="mt-4 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-900"
                  >
                    Lihat feedback ↓
                  </a>
                </section>
              )}
            </aside>
          </div>
        )}

        {result && (
          <section id="grading-results" className="space-y-5">
            <div>
              <p className="text-sm font-semibold text-blue-700">
                GRADING REPORT · SUBMISSION #{result.submission_id}
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Feedback per kriteria
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Skor menunjukkan seberapa baik jawabanmu memenuhi setiap
                kriteria. Kriteria dengan bobot nol tetap memberikan feedback,
                tetapi tidak masuk ke perhitungan nilai akhir.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {result.criterion_results.map((criterion) => (
                <article
                  key={criterion.criterion_id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-bold">{criterion.label}</h3>

                      <p className="mt-1 text-xs text-slate-500">
                        Bobot: {criterion.weight}
                        {" · "}
                        {criterion.included_in_final_score
                          ? "Dihitung ke nilai akhir"
                          : "Feedback only"}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-2xl font-bold tabular-nums">
                        {criterion.score}
                      </p>
                      <p className="text-xs text-slate-500">/ 100</p>
                    </div>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, criterion.score),
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Feedback AI
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {criterion.reasoning}
                    </p>
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        criterion.satisfied
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {criterion.satisfied
                        ? "Kriteria terpenuhi"
                        : "Masih perlu ditingkatkan"}
                    </span>
                  </div>
                </article>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
              Submission ini tersimpan dengan ID{" "}
              <strong>#{result.submission_id}</strong>. Nilai akhir dihitung
              dari bobot aktif yang dikonfigurasi guru pada saat penilaian.
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
