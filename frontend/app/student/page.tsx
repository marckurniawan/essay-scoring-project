"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import AppHeader from "@/components/AppHeader";
import {
  getMyExamAttempt,
  listExams,
  startExamAttempt,
  submitExam,
  saveQuestionDraft,
  type Exam,
  type ExamQuestion,
  type GradingResult,
  type SubmissionAttempt,
} from "@/lib/api";
import RoleGuard from "../../components/role-guard";

type DraftStatus = "idle" | "saving" | "saved" | "error";

function formatDate(value: string | null): string {
  if (!value) return "Tanggal tidak tersedia";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
}

function formatRemainingTime(totalSeconds: number | null): string {
  if (totalSeconds === null) return "--:--";
  const seconds = Math.max(0, totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getExamQuestions(exam: Exam): ExamQuestion[] {
  if (exam.questions?.length) return exam.questions;

  // Compatibility fallback for an exam returned by an older API response.
  return [
    {
      id: -exam.id,
      exam_id: exam.id,
      question: exam.question,
      weight: 100,
      position: 0,
      created_at: exam.created_at,
      criteria: exam.criteria ?? [],
    },
  ];
}

function isMissingActiveAttempt(error: unknown): boolean {
  return (
    error instanceof Error &&
    /no active attempt found|404/i.test(error.message)
  );
}

export default function StudentPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [attempt, setAttempt] = useState<SubmissionAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<GradingResult | null>(null);
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingAttempt, setLoadingAttempt] = useState(false);
  const [startingAttempt, setStartingAttempt] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const saveQueuesRef = useRef<Map<string, Promise<unknown>>>(new Map());
  const selectionRequestRef = useRef(0);
  const completedAttemptIdsRef = useRef<Set<number>>(new Set());
  const autoSubmitStartedRef = useRef(false);
  const submittingRef = useRef(false);
  const latestStateRef = useRef({
    selectedExam: undefined as Exam | undefined,
    attempt: null as SubmissionAttempt | null,
    answers: {} as Record<number, string>,
    questions: [] as ExamQuestion[],
  });

  const selectedExam = exams.find((exam) => exam.id === selectedExamId);
  const examQuestions = useMemo(
    () => (selectedExam ? getExamQuestions(selectedExam) : []),
    [selectedExam],
  );

  const attemptQuestions = useMemo(() => {
    if (!attempt?.questions?.length) return examQuestions;

    return attempt.questions.map((attemptQuestion, index) => {
      const examQuestion = examQuestions.find(
        (question) => question.id === attemptQuestion.question_id,
      );
      return {
        id: attemptQuestion.question_id,
        exam_id: attempt.exam_id,
        question: attemptQuestion.question,
        weight: attemptQuestion.weight,
        position: index,
        created_at: examQuestion?.created_at ?? null,
        criteria: examQuestion?.criteria ?? [],
      } satisfies ExamQuestion;
    });
  }, [attempt, examQuestions]);

  const filteredExams = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("id-ID");
    if (!query) return exams;

    return exams.filter((exam) => {
      const questions = getExamQuestions(exam);
      const searchableText = [
        exam.title,
        ...questions.flatMap((question) => [
          question.question,
          ...question.criteria.flatMap((criterion) => [criterion.label, criterion.description]),
        ]),
      ]
        .join(" ")
        .toLocaleLowerCase("id-ID");
      return searchableText.includes(query);
    });
  }, [exams, searchQuery]);

  useEffect(() => {
    latestStateRef.current = {
      selectedExam,
      attempt,
      answers,
      questions: attemptQuestions,
    };
  }, [selectedExam, attempt, answers, attemptQuestions]);

  useEffect(() => {
    let cancelled = false;

    listExams()
      .then((data) => {
        if (!cancelled) setExams(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Tidak dapat memuat daftar ujian.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingExams(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const submitCurrentAttempt = useCallback(async (automatic: boolean) => {
    const current = latestStateRef.current;
    const currentExam = current.selectedExam;
    const currentAttempt = current.attempt;
    const currentQuestions = current.questions;
    const currentAnswers = current.answers;

    if (!currentExam || !currentAttempt || currentAttempt.status !== "in_progress") {
      return;
    }
    if (submittingRef.current) return;

    const deadlinePassed = Date.now() >= Date.parse(currentAttempt.deadline_at);
    if (!automatic && !deadlinePassed) {
      const unanswered = currentQuestions.filter(
        (question) => !(currentAnswers[question.id] ?? "").trim(),
      );
      if (unanswered.length > 0) {
        setError(`Masih ada ${unanswered.length} soal yang belum dijawab.`);
        setNotice("");
        return;
      }
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    setNotice(automatic || deadlinePassed ? "Waktu habis. Sistem sedang menilai draft terakhir yang tersimpan." : "");

    try {
      const gradedResult = await submitExam(
        currentExam.id,
        currentQuestions.map((question) => ({
          question_id: question.id,
          student_answer: currentAnswers[question.id] ?? "",
        })),
      );
      completedAttemptIdsRef.current.add(currentAttempt.id);
      setResult(gradedResult);
      setAttempt({ ...currentAttempt, status: "graded" });
      setDraftStatus("saved");
      setNotice("Ujian selesai. Hasil penilaian berhasil dibuat.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Penilaian gagal. Silakan coba lagi.";
      setError(message);
      if (automatic || deadlinePassed) {
        setNotice("Waktu ujian sudah habis. Kamu dapat mencoba ulang penilaian menggunakan draft terakhir yang tersimpan.");
      } else {
        setNotice("Jawaban tetap tersimpan di request pengiriman bila backend sudah menerimanya. Periksa pesan error sebelum mencoba lagi.");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, []);

  useEffect(() => {
    autoSubmitStartedRef.current = false;
  }, [attempt?.id]);

  useEffect(() => {
    if (!attempt || attempt.status !== "in_progress") return;

    const deadlineMilliseconds = Date.parse(attempt.deadline_at);
    if (!Number.isFinite(deadlineMilliseconds)) return;

    let intervalId: number | undefined;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((deadlineMilliseconds - Date.now()) / 1000));
      setRemainingSeconds(seconds);

      if (seconds === 0 && !autoSubmitStartedRef.current) {
        autoSubmitStartedRef.current = true;
        void submitCurrentAttempt(true);
      }
    };

    const firstTick = window.setTimeout(() => {
      tick();
      intervalId = window.setInterval(tick, 1000);
    }, 0);

    return () => {
      window.clearTimeout(firstTick);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [attempt, submitCurrentAttempt]);

  const queueDraftSave = useCallback(
    (examId: number, submissionId: number, questionId: number, studentAnswer: string) => {
      const queueKey = `${submissionId}:${questionId}`;
      const previous = saveQueuesRef.current.get(queueKey) ?? Promise.resolve();
      const next = previous
        .catch(() => undefined)
        .then(() => saveQuestionDraft(examId, submissionId, questionId, studentAnswer));
      saveQueuesRef.current.set(queueKey, next);
      return next.finally(() => {
        if (saveQueuesRef.current.get(queueKey) === next) {
          saveQueuesRef.current.delete(queueKey);
        }
      });
    },
    [],
  );

  useEffect(() => {
    if (!selectedExam || !attempt || attempt.status !== "in_progress") return;
    if (Date.now() >= Date.parse(attempt.deadline_at)) return;

    const timer = window.setTimeout(() => {
      if (Date.now() >= Date.parse(attempt.deadline_at)) return;

      const currentAnswers = attemptQuestions.map((question) => ({
        questionId: question.id,
        answer: answers[question.id] ?? "",
      }));

      setDraftStatus("saving");
      Promise.all(
        currentAnswers.map(({ questionId, answer }) =>
          queueDraftSave(selectedExam.id, attempt.id, questionId, answer),
        ),
      )
        .then(() => {
          if (latestStateRef.current.attempt?.id !== attempt.id) return;
          if (completedAttemptIdsRef.current.has(attempt.id)) return;
          setDraftStatus("saved");
          setError((current) =>
            /draft|simpan jawaban/i.test(current) ? "" : current,
          );
        })
        .catch((err: unknown) => {
          if (
            latestStateRef.current.attempt?.id === attempt.id &&
            !completedAttemptIdsRef.current.has(attempt.id) &&
            Date.now() < Date.parse(attempt.deadline_at)
          ) {
            setDraftStatus("error");
            setError(
              err instanceof Error
                ? `Draft belum berhasil disimpan: ${err.message}`
                : "Draft belum berhasil disimpan. Periksa koneksi internet.",
            );
          }
        });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [answers, attempt, attemptQuestions, queueDraftSave, selectedExam]);

  async function openExam(exam: Exam) {
    const requestId = ++selectionRequestRef.current;
    setSelectedExamId(exam.id);
    setAttempt(null);
    setAnswers({});
    setResult(null);
    setError("");
    setNotice("");
    setDraftStatus("idle");
    setRemainingSeconds(null);
    setLoadingAttempt(true);

    try {
      const restoredAttempt = await getMyExamAttempt(exam.id);
      if (requestId !== selectionRequestRef.current) return;
      if (restoredAttempt.status === "in_progress") {
        setAttempt(restoredAttempt);
        setAnswers(
          Object.fromEntries(
            (restoredAttempt.questions ?? []).map((question) => [
              question.question_id,
              question.student_answer,
            ]),
          ),
        );
        setNotice("Pengerjaan sebelumnya ditemukan dan berhasil dipulihkan.");
      }
    } catch (err) {
      if (requestId !== selectionRequestRef.current) return;
      if (!isMissingActiveAttempt(err)) {
        setError(err instanceof Error ? err.message : "Tidak dapat memulihkan pengerjaan ujian.");
      }
    } finally {
      if (requestId === selectionRequestRef.current) setLoadingAttempt(false);
    }
  }

  async function handleStartExam() {
    if (!selectedExam) return;
    const requestId = selectionRequestRef.current;
    const examId = selectedExam.id;
    setStartingAttempt(true);
    setError("");
    setNotice("");

    try {
      const startedAttempt = await startExamAttempt(examId);
      if (requestId !== selectionRequestRef.current) return;
      setRemainingSeconds(null);
      setAttempt(startedAttempt);
      setAnswers(
        Object.fromEntries(
          (startedAttempt.questions ?? []).map((question) => [
            question.question_id,
            question.student_answer,
          ]),
        ),
      );
      setResult(null);
      setDraftStatus("saved");
      setNotice("Ujian dimulai. Draft akan disimpan otomatis selama waktu masih tersedia.");
    } catch (err) {
      if (requestId === selectionRequestRef.current) {
        setError(err instanceof Error ? err.message : "Tidak dapat memulai ujian.");
      }
    } finally {
      if (requestId === selectionRequestRef.current) setStartingAttempt(false);
    }
  }

  function handleAnswerChange(questionId: number, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setError("");
    setNotice("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitCurrentAttempt(false);
  }

  const timeIsUp = remainingSeconds !== null && remainingSeconds <= 0;
  const canEditAnswers = Boolean(attempt?.status === "in_progress" && !timeIsUp && !submitting);
  const timerIsUrgent = remainingSeconds !== null && remainingSeconds <= 300;

  return (
    <RoleGuard requiredRole="student">
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <AppHeader page="student" />

        <div className="mx-auto max-w-7xl space-y-7 px-5 py-7 sm:px-8 lg:py-9">
          <section className="border-b border-slate-200 pb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Student workspace</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Choose an assessment</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Pilih ujian untuk melihat soal. Semua jawaban dikerjakan dalam satu sesi dengan satu batas waktu.
            </p>
          </section>

          {error && (
            <div role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
              <span className="font-semibold">Perlu perhatian.</span> {error}
            </div>
          )}
          {notice && (
            <div role="status" className="border-l-4 border-blue-600 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              {notice}
            </div>
          )}

          {loadingExams ? (
            <div role="status" className="border-y border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500">Memuat assessment...</div>
          ) : exams.length === 0 ? (
            <section className="border-y border-slate-200 bg-white px-5 py-10 sm:px-8">
              <h2 className="text-xl font-semibold text-slate-950">Belum ada ujian</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Guru perlu membuat ujian terlebih dahulu sebelum kamu dapat mengerjakan essay.</p>
            </section>
          ) : (
            <div className="grid items-start gap-7 lg:grid-cols-[minmax(270px,0.78fr)_minmax(0,1.55fr)]">
              <aside className="min-w-0">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="text-base font-semibold text-slate-950">Available exams</h2>
                  <span className="text-xs tabular-nums text-slate-500">{filteredExams.length} of {exams.length}</span>
                </div>
                <div className="mb-3 flex gap-2">
                  <label htmlFor="student-exam-search" className="sr-only">Cari ujian</label>
                  <input
                    id="student-exam-search"
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Cari ujian..."
                    className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="space-y-2 lg:max-h-[680px] lg:overflow-y-auto lg:pr-1">
                  {filteredExams.map((exam) => {
                    const isSelected = selectedExamId === exam.id;
                    const questions = getExamQuestions(exam);
                    return (
                      <article key={exam.id} className={`border bg-white transition-colors ${isSelected ? "border-blue-700 ring-1 ring-blue-700" : "border-slate-200 hover:border-slate-400"}`}>
                        <button
                          type="button"
                          onClick={() => void openExam(exam)}
                          aria-pressed={isSelected}
                          className="block w-full p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-700"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Exam #{exam.id}</p>
                              <h3 className="mt-1 break-words text-sm font-semibold leading-5 text-slate-950">{exam.title}</h3>
                            </div>
                            <span className="shrink-0 text-xs font-medium text-slate-500">{exam.duration_minutes} min</span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-600">{questions.length} soal</p>
                          <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                            <span>{formatDate(exam.created_at)}</span>
                            <span className={isSelected ? "font-semibold text-blue-700" : "font-medium"}>{isSelected ? "Dipilih" : "Lihat detail"}</span>
                          </div>
                        </button>
                      </article>
                    );
                  })}
                </div>
              </aside>

              <section className="min-w-0">
                {!selectedExam ? (
                  <div className="flex min-h-72 flex-col items-center justify-center border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                    <h2 className="text-lg font-semibold text-slate-950">Pilih ujian untuk memulai</h2>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">Detail pertanyaan, durasi, dan kriteria akan tampil di area ini.</p>
                  </div>
                ) : loadingAttempt ? (
                  <div role="status" className="border border-slate-200 bg-white p-8 text-sm text-slate-600">Memeriksa pengerjaan yang tersimpan...</div>
                ) : result ? (
                  <section className="border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 p-5 sm:px-6">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Assessment completed</p>
                      <h2 className="mt-1 text-xl font-semibold text-slate-950">{selectedExam.title}</h2>
                      <p className="mt-2 text-sm text-slate-600">Nilai akhir ujian</p>
                      <p className="mt-1 text-4xl font-semibold tabular-nums text-slate-950">{result.final_score.toFixed(2)}<span className="ml-1 text-base font-normal text-slate-500">/ 100</span></p>
                    </div>
                    <div className="space-y-4 p-5 sm:p-6">
                      {(result.question_results ?? []).map((questionResult, index) => (
                        <article key={questionResult.question_submission_id} className="border border-slate-200 p-4 sm:p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Soal {index + 1} · Bobot {questionResult.weight}</p>
                              <h3 className="mt-1 text-sm font-semibold leading-6 text-slate-950">{questionResult.question}</h3>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-semibold tabular-nums text-slate-950">{questionResult.question_score === null ? "—" : questionResult.question_score.toFixed(2)}</p>
                              <p className="text-xs text-slate-500">Nilai soal / 100</p>
                            </div>
                          </div>
                          <div className="mt-4 space-y-3">
                            {questionResult.criterion_results.map((criterion) => (
                              <div key={criterion.criterion_id} className="border-t border-slate-100 pt-3">
                                <div className="flex items-start justify-between gap-3">
                                  <h4 className="text-sm font-semibold text-slate-900">{criterion.label}</h4>
                                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{criterion.score}/100</span>
                                </div>
                                <p className="mt-1 text-sm leading-6 text-slate-600">{criterion.reasoning}</p>
                                <p className="mt-1 text-xs text-slate-500">Bobot kriteria {criterion.weight}{criterion.included_in_final_score ? " · masuk perhitungan" : " · feedback saja"}</p>
                              </div>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                    <div className="border-t border-slate-200 p-5">
                      <button type="button" onClick={() => { setSelectedExamId(null); setAttempt(null); setAnswers({}); setResult(null); setNotice(""); setError(""); }} className="inline-flex min-h-10 items-center justify-center border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Kembali ke daftar ujian</button>
                    </div>
                  </section>
                ) : (
                  <div className="space-y-5">
                    <section className="border border-slate-200 bg-white">
                      <div className="border-b border-slate-200 p-5 sm:px-6">
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Exam #{selectedExam.id}</p>
                        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{selectedExam.title}</h2>
                        <p className="mt-2 text-sm text-slate-600">{examQuestions.length} soal · Durasi {selectedExam.duration_minutes} menit</p>
                        <p className="mt-2 text-xs leading-5 text-slate-500">Waktu mulai dihitung dari server saat kamu memilih Start Test. Draft jawaban disimpan otomatis.</p>
                      </div>
                      {!attempt ? (
                        <div className="space-y-4 p-5 sm:p-6">
                          <div className="space-y-4">
                            {examQuestions.map((question, index) => (
                              <article key={question.id} className="border border-slate-200 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <h3 className="text-sm font-semibold text-slate-950">Soal {index + 1}</h3>
                                  <span className="text-xs font-medium text-slate-500">Bobot {question.weight}</span>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{question.question}</p>
                                <details className="mt-3 text-xs text-slate-600">
                                  <summary className="cursor-pointer font-semibold">Kriteria penilaian ({question.criteria.length})</summary>
                                  <ul className="mt-2 space-y-2 pl-4">
                                    {question.criteria.map((criterion) => (
                                      <li key={criterion.id}>
                                        <span className="font-semibold">{criterion.label}</span> — {criterion.description}
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              </article>
                            ))}
                          </div>
                          <button type="button" onClick={() => void handleStartExam()} disabled={startingAttempt} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
                            {startingAttempt ? "Memulai ujian..." : "Start Test"}
                          </button>
                        </div>
                      ) : (
                        <div className="p-5 sm:p-6">
                          <div className={`sticky top-3 z-10 mb-5 flex flex-wrap items-center justify-between gap-3 border p-4 ${timerIsUrgent ? "border-red-300 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Waktu tersisa</p>
                              <p className={`mt-1 text-2xl font-semibold tabular-nums ${timerIsUrgent ? "text-red-700" : "text-slate-950"}`}>{formatRemainingTime(remainingSeconds)}</p>
                            </div>
                            <div className="text-right text-xs text-slate-600">
                              <p>{attemptQuestions.length} soal</p>
                              <p className="mt-1">{draftStatus === "saving" ? "Menyimpan draft..." : draftStatus === "saved" ? "Draft tersimpan" : draftStatus === "error" ? "Draft belum tersimpan" : "Autosave aktif"}</p>
                            </div>
                          </div>

                          <form onSubmit={handleSubmit} className="space-y-5">
                            {attemptQuestions.map((question, index) => (
                              <article key={question.id} className="border border-slate-200 p-4 sm:p-5">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Soal {index + 1}</p>
                                    <h3 className="mt-1 text-sm font-semibold leading-6 text-slate-950">{question.question}</h3>
                                  </div>
                                  <span className="shrink-0 text-xs font-semibold text-slate-600">Bobot {question.weight}</span>
                                </div>
                                <label htmlFor={`answer-${question.id}`} className="mt-4 block text-sm font-semibold text-slate-900">Jawaban kamu</label>
                                <textarea
                                  id={`answer-${question.id}`}
                                  value={answers[question.id] ?? ""}
                                  onChange={(event) => handleAnswerChange(question.id, event.target.value)}
                                  disabled={!canEditAnswers}
                                  maxLength={50000}
                                  rows={8}
                                  placeholder="Tuliskan jawaban untuk soal ini..."
                                  className="mt-2 min-h-[180px] w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-7 outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-600"
                                />
                                <p className="mt-2 text-xs text-slate-500">{(answers[question.id] ?? "").length.toLocaleString("id-ID")} karakter</p>
                                <details className="mt-3 text-xs text-slate-600">
                                  <summary className="cursor-pointer font-semibold">Kriteria penilaian ({question.criteria.length})</summary>
                                  <ul className="mt-2 space-y-2 pl-4">
                                    {question.criteria.map((criterion) => (
                                      <li key={criterion.id}>
                                        <span className="font-semibold">{criterion.label}</span> — {criterion.description}
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              </article>
                            ))}

                            {timeIsUp && (
                              <div className="border-l-4 border-amber-600 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                Waktu telah habis. Jawaban tidak bisa diedit. Sistem akan menilai draft terakhir yang tersimpan.
                              </div>
                            )}

                            <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-xs leading-5 text-slate-500">Pastikan seluruh soal dijawab. Nilai akhir mengikuti bobot soal dan kriteria yang ditetapkan guru.</p>
                              <button type="submit" disabled={submitting || (attempt.status !== "in_progress")} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
                                {submitting ? "Menilai jawaban..." : timeIsUp ? "Coba penilaian ulang" : "Submit seluruh jawaban"}
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </section>
            </div>
          )}

          <footer className="border-t border-slate-200 pt-4 text-xs text-slate-500">Essay Scoring · Student workspace</footer>
        </div>
      </main>
    </RoleGuard>
  );
}
