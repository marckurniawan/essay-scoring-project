"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import AppHeader from "@/components/AppHeader";
import {
  createExam,
  listExams,
  updateCriterionWeight,
  updateExamQuestion,
  type Criterion,
  type Exam,
  type ExamQuestion,
} from "@/lib/api";
import Badge from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/button";
import { formatDate } from "@/lib/formatDate";
import PageFooter from "@/components/PageFooter";
import RoleGuard from "@/components/role-guard";
import TeacherScoreProtests from "@/components/teacher-score-protests";

type DraftCriterion = {
  label: string;
  description: string;
  weight: string;
};

type DraftQuestion = {
  question: string;
  weight: string;
  criteria: DraftCriterion[];
};

const INITIAL_CRITERION: DraftCriterion = {
  label: "",
  description: "",
  weight: "100",
};

function createDraftQuestion(): DraftQuestion {
  return {
    question: "",
    weight: "100",
    criteria: [{ ...INITIAL_CRITERION }],
  };
}

function getQuestions(exam: Exam): ExamQuestion[] {
  if (exam.questions?.length) return exam.questions;

  // Compatibility fallback for exams returned by an older API.
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

function updateCriterionInExam(
  exam: Exam,
  criterionId: number,
  weight: number,
): Exam {
  return {
    ...exam,
    criteria: (exam.criteria ?? []).map((criterion) =>
      criterion.id === criterionId ? { ...criterion, weight } : criterion,
    ),
    questions: getQuestions(exam).map((question) => ({
      ...question,
      criteria: question.criteria.map((criterion) =>
        criterion.id === criterionId ? { ...criterion, weight } : criterion,
      ),
    })),
  };
}

function updateQuestionInExam(
  exam: Exam,
  questionId: number,
  updates: Partial<Pick<ExamQuestion, "question" | "weight">>,
): Exam {
  const questions = getQuestions(exam).map((question) =>
    question.id === questionId ? { ...question, ...updates } : question,
  );

  return {
    ...exam,
    question: questions[0]?.question ?? exam.question,
    questions,
  };
}

export default function TeacherPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingExam, setSavingExam] = useState(false);
  const [savingCriterionId, setSavingCriterionId] = useState<number | null>(null);
  const [savingQuestionId, setSavingQuestionId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [weightDrafts, setWeightDrafts] = useState<Record<number, string>>({});
  const [questionWeightDrafts, setQuestionWeightDrafts] = useState<Record<number, string>>({});
  const [editingCriterionId, setEditingCriterionId] = useState<number | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedExamId, setExpandedExamId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([
    createDraftQuestion(),
  ]);

  const applyExams = useCallback((data: Exam[]) => {
    setExams(data);
    setWeightDrafts(
      Object.fromEntries(
        data.flatMap((exam) =>
          getQuestions(exam).flatMap((question) =>
            question.criteria.map((criterion) => [criterion.id, String(criterion.weight)]),
          ),
        ),
      ),
    );
    setQuestionWeightDrafts(
      Object.fromEntries(
        data.flatMap((exam) =>
          getQuestions(exam).map((question) => [question.id, String(question.weight)]),
        ),
      ),
    );
  }, []);

  const loadExams = useCallback(async () => {
    try {
      const data = await listExams();
      applyExams(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tidak dapat mengambil data ujian.");
    } finally {
      setLoading(false);
    }
  }, [applyExams]);

  useEffect(() => {
    let cancelled = false;

    listExams()
      .then((data) => {
        if (!cancelled) applyExams(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Tidak dapat mengambil data ujian.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applyExams]);

  const filteredExams = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("id-ID");
    if (!query) return exams;

    return exams.filter((exam) => {
      const questions = getQuestions(exam);
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

  function updateDraftQuestion(
    questionIndex: number,
    field: "question" | "weight",
    value: string,
  ) {
    setDraftQuestions((current) =>
      current.map((question, index) =>
        index === questionIndex ? { ...question, [field]: value } : question,
      ),
    );
  }

  function addQuestion() {
    setDraftQuestions((current) => [...current, createDraftQuestion()]);
  }

  function removeQuestion(questionIndex: number) {
    setDraftQuestions((current) => current.filter((_, index) => index !== questionIndex));
  }

  function updateDraftCriterion(
    questionIndex: number,
    criterionIndex: number,
    field: keyof DraftCriterion,
    value: string,
  ) {
    setDraftQuestions((current) =>
      current.map((question, currentQuestionIndex) => {
        if (currentQuestionIndex !== questionIndex) return question;

        return {
          ...question,
          criteria: question.criteria.map((criterion, currentCriterionIndex) =>
            currentCriterionIndex === criterionIndex
              ? { ...criterion, [field]: value }
              : criterion,
          ),
        };
      }),
    );
  }

  function addCriterion(questionIndex: number) {
    setDraftQuestions((current) =>
      current.map((question, index) =>
        index === questionIndex
          ? {
              ...question,
              criteria: [...question.criteria, { ...INITIAL_CRITERION, weight: "0" }],
            }
          : question,
      ),
    );
  }

  function removeCriterion(questionIndex: number, criterionIndex: number) {
    setDraftQuestions((current) =>
      current.map((question, index) =>
        index === questionIndex
          ? {
              ...question,
              criteria: question.criteria.filter((_, currentIndex) => currentIndex !== criterionIndex),
            }
          : question,
      ),
    );
  }

  async function handleCreateExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!title.trim()) {
      setError("Judul ujian harus diisi.");
      return;
    }

    const parsedDuration = Number(durationMinutes);
    if (
      durationMinutes.trim() === "" ||
      !Number.isInteger(parsedDuration) ||
      parsedDuration < 1 ||
      parsedDuration > 240
    ) {
      setError("Durasi ujian harus berupa bilangan bulat antara 1 dan 240 menit.");
      return;
    }

    if (draftQuestions.length === 0) {
      setError("Tambahkan minimal satu soal.");
      return;
    }

    const parsedQuestions = [] as {
      question: string;
      weight: number;
      criteria: { label: string; description: string; weight: number; max_score: number }[];
    }[];

    for (let questionIndex = 0; questionIndex < draftQuestions.length; questionIndex += 1) {
      const draftQuestion = draftQuestions[questionIndex];
      const questionWeight = Number(draftQuestion.weight);

      if (!draftQuestion.question.trim()) {
        setError(`Pertanyaan pada Soal ${questionIndex + 1} harus diisi.`);
        return;
      }
      if (
        draftQuestion.weight.trim() === "" ||
        !Number.isFinite(questionWeight) ||
        questionWeight < 0
      ) {
        setError(`Bobot Soal ${questionIndex + 1} harus berupa angka nol atau lebih.`);
        return;
      }
      if (draftQuestion.criteria.length === 0) {
        setError(`Tambahkan minimal satu kriteria pada Soal ${questionIndex + 1}.`);
        return;
      }

      const parsedCriteria = [] as {
        label: string;
        description: string;
        weight: number;
        max_score: number;
      }[];

      for (let criterionIndex = 0; criterionIndex < draftQuestion.criteria.length; criterionIndex += 1) {
        const criterion = draftQuestion.criteria[criterionIndex];
        const criterionWeight = Number(criterion.weight);

        if (
          !criterion.label.trim() ||
          !criterion.description.trim() ||
          criterion.weight.trim() === "" ||
          !Number.isFinite(criterionWeight) ||
          criterionWeight < 0
        ) {
          setError(
            `Lengkapi label, deskripsi, dan bobot kriteria ${criterionIndex + 1} pada Soal ${questionIndex + 1}.`,
          );
          return;
        }

        parsedCriteria.push({
          label: criterion.label.trim(),
          description: criterion.description.trim(),
          weight: criterionWeight,
          max_score: 100,
        });
      }

      if (questionWeight > 0 && !parsedCriteria.some((criterion) => criterion.weight > 0)) {
        setError(`Soal ${questionIndex + 1} memiliki bobot positif sehingga perlu kriteria dengan bobot positif.`);
        return;
      }

      parsedQuestions.push({
        question: draftQuestion.question.trim(),
        weight: questionWeight,
        criteria: parsedCriteria,
      });
    }

    if (parsedQuestions.reduce((total, question) => total + question.weight, 0) <= 0) {
      setError("Minimal satu soal harus memiliki bobot lebih dari nol.");
      return;
    }

    setSavingExam(true);
    try {
      const created = await createExam({
        title: title.trim(),
        duration_minutes: parsedDuration,
        questions: parsedQuestions,
      });

      setTitle("");
      setDurationMinutes("30");
      setDraftQuestions([createDraftQuestion()]);
      setShowCreateForm(false);
      setExpandedExamId(created.id);
      setSearchQuery("");
      setNotice(`Ujian “${created.title}” berhasil dibuat.`);
      setLoading(true);
      await loadExams();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat ujian.");
    } finally {
      setSavingExam(false);
    }
  }

  async function saveWeight(examId: number, criterionId: number) {
    setError("");
    setNotice("");
    const rawWeight = weightDrafts[criterionId] ?? "";

    if (rawWeight.trim() === "" || !Number.isFinite(Number(rawWeight)) || Number(rawWeight) < 0) {
      setError("Bobot kriteria harus berupa angka nol atau lebih.");
      return;
    }

    setSavingCriterionId(criterionId);
    try {
      const updated = await updateCriterionWeight(examId, criterionId, Number(rawWeight));
      setWeightDrafts((current) => ({ ...current, [criterionId]: String(updated.weight) }));
      setExams((current) =>
        current.map((exam) =>
          exam.id === examId ? updateCriterionInExam(exam, criterionId, updated.weight) : exam,
        ),
      );
      setEditingCriterionId(null);
      setNotice("Bobot kriteria berhasil diperbarui.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui bobot kriteria.");
    } finally {
      setSavingCriterionId(null);
    }
  }

  async function saveQuestionWeight(examId: number, questionId: number) {
    setError("");
    setNotice("");
    const rawWeight = questionWeightDrafts[questionId] ?? "";

    if (rawWeight.trim() === "" || !Number.isFinite(Number(rawWeight)) || Number(rawWeight) < 0) {
      setError("Bobot soal harus berupa angka nol atau lebih.");
      return;
    }

    setSavingQuestionId(questionId);
    try {
      const updated = await updateExamQuestion(examId, questionId, { weight: Number(rawWeight) });
      setQuestionWeightDrafts((current) => ({ ...current, [questionId]: String(updated.weight) }));
      setExams((current) =>
        current.map((exam) =>
          exam.id === examId
            ? updateQuestionInExam(exam, questionId, { weight: updated.weight })
            : exam,
        ),
      );
      setEditingQuestionId(null);
      setNotice("Bobot soal berhasil diperbarui.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui bobot soal.");
    } finally {
      setSavingQuestionId(null);
    }
  }

  function renderExamCard(exam: Exam, layout: string) {
    const isExpanded = expandedExamId === exam.id;
    const questions = getQuestions(exam);
    const criteriaCount = questions.reduce((total, question) => total + question.criteria.length, 0);
    const activeCriteriaCount = questions.reduce(
      (total, question) => total + question.criteria.filter((criterion) => criterion.weight > 0).length,
      0,
    );
    const totalQuestionWeight = questions.reduce((total, question) => total + question.weight, 0);

    return (
      <article
        key={`${layout}-${exam.id}`}
        className="min-w-0 break-inside-avoid overflow-hidden rounded-2xl border border-slate-200 bg-white"
      >
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Ujian #{exam.id}</p>
            <h3 className="mt-1 break-words text-base font-semibold tracking-tight text-slate-950">{exam.title}</h3>
            <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm leading-5 text-slate-600">
              {questions.length} soal · {questions[0]?.question ?? exam.question}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
              <span>Durasi: {exam.duration_minutes} menit</span>
              <span>{questions.length} soal</span>
              <span>Dibuat {formatDate(exam.created_at)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpandedExamId(isExpanded ? null : exam.id)}
            aria-expanded={isExpanded}
            aria-controls={`exam-detail-${layout}-${exam.id}`}
            className={buttonClass("secondary", "min-h-9 shrink-0 gap-2 px-3 py-2")}
          >
            {isExpanded ? "Sembunyikan" : "Detail"}
            <span aria-hidden="true">{isExpanded ? "−" : "+"}</span>
          </button>
        </div>

        {isExpanded && (
          <div
            id={`exam-detail-${layout}-${exam.id}`}
            className="space-y-4 border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5"
          >
            <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Durasi</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950">{exam.duration_minutes} menit</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Jumlah soal</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950">{questions.length}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Kriteria aktif</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950">{activeCriteriaCount}/{criteriaCount}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total bobot soal</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950">{Number(totalQuestionWeight.toFixed(2))}</p>
              </div>
            </div>

            {questions.map((question, questionIndex) => {
              const editingQuestionWeight = editingQuestionId === question.id;
              const questionWeightInputId = `question-weight-${layout}-${question.id}`;

              return (
                <section key={question.id} className="border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Soal {questionIndex + 1}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{question.question}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-slate-600">Bobot {question.weight}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    {editingQuestionWeight ? (
                      <>
                        <div className="w-32">
                          <label htmlFor={questionWeightInputId} className="mb-1 block text-xs font-medium text-slate-600">
                            Bobot soal
                          </label>
                          <input
                            id={questionWeightInputId}
                            type="number"
                            min="0"
                            step="0.1"
                            value={questionWeightDrafts[question.id] ?? String(question.weight)}
                            onChange={(event) =>
                              setQuestionWeightDrafts((current) => ({
                                ...current,
                                [question.id]: event.target.value,
                              }))
                            }
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-700 focus:ring-2 focus:ring-sky-100"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void saveQuestionWeight(exam.id, question.id)}
                            disabled={savingQuestionId === question.id}
                            className={buttonClass("primary", "min-h-9 px-3 py-2")}
                          >
                            {savingQuestionId === question.id ? "Menyimpan…" : "Simpan"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setQuestionWeightDrafts((current) => ({
                                ...current,
                                [question.id]: String(question.weight),
                              }));
                              setEditingQuestionId(null);
                            }}
                            disabled={savingQuestionId === question.id}
                            className={buttonClass("secondary", "min-h-9 px-3 py-2 font-medium")}
                          >
                            Batal
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-slate-500">Bobot relatif terhadap soal lain dalam ujian ini.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setQuestionWeightDrafts((current) => ({
                              ...current,
                              [question.id]: String(question.weight),
                            }));
                            setEditingQuestionId(question.id);
                          }}
                          className={buttonClass("secondary", "min-h-9 px-3 py-2")}
                        >
                          Edit bobot soal
                        </button>
                      </>
                    )}
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <h4 className="text-sm font-semibold text-slate-900">Kriteria soal ini</h4>
                    <div className="mt-3 space-y-3">
                      {question.criteria.map((criterion: Criterion) => {
                        const isEditingWeight = editingCriterionId === criterion.id;
                        const weightInputId = `criterion-weight-${layout}-${criterion.id}`;

                        return (
                          <div key={criterion.id} className="border border-slate-200 p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h5 className="text-sm font-semibold text-slate-900">{criterion.label}</h5>
                                <p className="mt-1 text-sm leading-5 text-slate-600">{criterion.description}</p>
                              </div>
                              {criterion.weight === 0 && (
                                <span className="shrink-0 text-xs font-medium text-amber-800">Feedback saja</span>
                              )}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                              {isEditingWeight ? (
                                <>
                                  <div className="w-28">
                                    <label htmlFor={weightInputId} className="mb-1 block text-xs font-medium text-slate-600">
                                      Bobot kriteria
                                    </label>
                                    <input
                                      id={weightInputId}
                                      type="number"
                                      min="0"
                                      step="0.1"
                                      value={weightDrafts[criterion.id] ?? String(criterion.weight)}
                                      onChange={(event) =>
                                        setWeightDrafts((current) => ({
                                          ...current,
                                          [criterion.id]: event.target.value,
                                        }))
                                      }
                                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-700 focus:ring-2 focus:ring-sky-100"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void saveWeight(exam.id, criterion.id)}
                                      disabled={savingCriterionId === criterion.id}
                                      className={buttonClass("primary", "min-h-9 px-3 py-2")}
                                    >
                                      {savingCriterionId === criterion.id ? "Menyimpan…" : "Simpan"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setWeightDrafts((current) => ({
                                          ...current,
                                          [criterion.id]: String(criterion.weight),
                                        }));
                                        setEditingCriterionId(null);
                                      }}
                                      disabled={savingCriterionId === criterion.id}
                                      className={buttonClass("secondary", "min-h-9 px-3 py-2 font-medium")}
                                    >
                                      Batal
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <p className="text-sm text-slate-700">Bobot <span className="font-semibold text-slate-950">{criterion.weight}</span></p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setWeightDrafts((current) => ({
                                        ...current,
                                        [criterion.id]: String(criterion.weight),
                                      }));
                                      setEditingCriterionId(criterion.id);
                                    }}
                                    className={buttonClass("secondary", "min-h-9 px-3 py-2")}
                                  >
                                    Edit bobot kriteria
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </article>
    );
  }

  return (
    <RoleGuard requiredRole="teacher">
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <AppHeader page="teacher" />

        <div className="mx-auto max-w-7xl space-y-8 px-5 py-7 sm:px-8 lg:py-9">
          <section className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
            <div className="max-w-3xl">
              <Badge>Ruang Guru</Badge>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Kelola ujian &amp; rubrik</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Buat satu ujian dengan beberapa soal. Setiap soal memiliki bobot dan kriteria penilaiannya sendiri.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm((current) => !current)}
              aria-expanded={showCreateForm}
              aria-controls="create-exam-panel"
              className={buttonClass("primary", "px-4 py-2.5")}
            >
              {showCreateForm ? "Tutup form" : "+ Buat ujian"}
            </button>
          </section>

          {error && (
            <div role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
              <span className="font-semibold">Terjadi kesalahan.</span> {error}
            </div>
          )}
          {notice && (
            <div role="status" className="border-l-4 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {notice}
            </div>
          )}

          {showCreateForm && (
            <section id="create-exam-panel" className="scroll-mt-5 border border-slate-200 bg-white p-5 sm:p-7">
              <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ujian baru</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Buat ujian</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Atur durasi ujian, tambahkan beberapa soal, lalu tentukan bobot dan rubrik setiap soal.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="self-start rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700"
                >
                  Batal
                </button>
              </div>

              <form onSubmit={handleCreateExam} className="space-y-7">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="exam-title" className="mb-2 block text-sm font-medium text-slate-800">Judul ujian</label>
                    <input
                      id="exam-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      required
                      maxLength={200}
                      placeholder="Contoh: Machine Learning Fundamentals"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-sky-700 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="exam-duration" className="mb-2 block text-sm font-medium text-slate-800">Durasi ujian (menit)</label>
                    <input
                      id="exam-duration"
                      type="number"
                      min="1"
                      max="240"
                      step="1"
                      value={durationMinutes}
                      onChange={(event) => setDurationMinutes(event.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sky-700 focus:ring-2 focus:ring-sky-100"
                    />
                    <p className="mt-1.5 text-xs text-slate-500">Durasi berlaku untuk keseluruhan ujian.</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">Soal ujian</h3>
                      <p className="mt-1 text-sm text-slate-500">Bobot soal menentukan kontribusinya terhadap nilai akhir. Total bobot tidak wajib 100.</p>
                    </div>
                    <button
                      type="button"
                      onClick={addQuestion}
                      className={buttonClass("secondary", "min-h-9 px-3 py-2 font-medium")}
                    >
                      + Tambah soal
                    </button>
                  </div>

                  {draftQuestions.map((question, questionIndex) => (
                    <section key={questionIndex} className="border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <h4 className="text-sm font-semibold text-slate-950">Soal {questionIndex + 1}</h4>
                        <button
                          type="button"
                          onClick={() => removeQuestion(questionIndex)}
                          disabled={draftQuestions.length === 1}
                          className="rounded-md px-3 py-2 text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          Hapus soal
                        </button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_150px]">
                        <div>
                          <label htmlFor={`question-text-${questionIndex}`} className="mb-1.5 block text-xs font-medium text-slate-600">Pertanyaan</label>
                          <textarea
                            id={`question-text-${questionIndex}`}
                            value={question.question}
                            onChange={(event) => updateDraftQuestion(questionIndex, "question", event.target.value)}
                            rows={3}
                            required
                            placeholder="Tuliskan pertanyaan essay..."
                            className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-slate-400 focus:border-sky-700 focus:ring-2 focus:ring-sky-100"
                          />
                        </div>
                        <div>
                          <label htmlFor={`question-weight-${questionIndex}`} className="mb-1.5 block text-xs font-medium text-slate-600">Bobot soal</label>
                          <input
                            id={`question-weight-${questionIndex}`}
                            type="number"
                            min="0"
                            step="0.1"
                            value={question.weight}
                            onChange={(event) => updateDraftQuestion(questionIndex, "weight", event.target.value)}
                            required
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-700 focus:ring-2 focus:ring-sky-100"
                          />
                          <p className="mt-1.5 text-xs text-slate-500">0 mengecualikan soal dari nilai akhir.</p>
                        </div>
                      </div>

                      <div className="mt-5 border-t border-slate-200 pt-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h5 className="text-sm font-semibold text-slate-900">Rubric Soal {questionIndex + 1}</h5>
                            <p className="mt-1 text-xs text-slate-500">AI akan menilai jawaban soal ini menggunakan kriteria di bawah.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => addCriterion(questionIndex)}
                            className={buttonClass("secondary", "min-h-9 px-3 py-2 font-medium")}
                          >
                            + Tambah kriteria
                          </button>
                        </div>

                        <div className="space-y-3">
                          {question.criteria.map((criterion, criterionIndex) => (
                            <div key={criterionIndex} className="grid gap-3 border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(130px,0.8fr)_minmax(180px,1.4fr)_110px_auto] sm:items-start">
                              <div>
                                <label htmlFor={`criterion-label-${questionIndex}-${criterionIndex}`} className="mb-1.5 block text-xs font-medium text-slate-600">Nama kriteria</label>
                                <input
                                  id={`criterion-label-${questionIndex}-${criterionIndex}`}
                                  value={criterion.label}
                                  onChange={(event) => updateDraftCriterion(questionIndex, criterionIndex, "label", event.target.value)}
                                  required
                                  maxLength={200}
                                  placeholder="Contoh: Ketepatan konsep"
                                  className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-sky-700 focus:ring-2 focus:ring-sky-100"
                                />
                              </div>
                              <div>
                                <label htmlFor={`criterion-description-${questionIndex}-${criterionIndex}`} className="mb-1.5 block text-xs font-medium text-slate-600">Deskripsi rubrik</label>
                                <textarea
                                  id={`criterion-description-${questionIndex}-${criterionIndex}`}
                                  value={criterion.description}
                                  onChange={(event) => updateDraftCriterion(questionIndex, criterionIndex, "description", event.target.value)}
                                  required
                                  rows={2}
                                  placeholder="Jelaskan aspek jawaban yang dinilai..."
                                  className="w-full resize-y rounded-md border border-slate-300 px-3 py-2.5 text-sm leading-5 outline-none placeholder:text-slate-400 focus:border-sky-700 focus:ring-2 focus:ring-sky-100"
                                />
                              </div>
                              <div>
                                <label htmlFor={`criterion-weight-${questionIndex}-${criterionIndex}`} className="mb-1.5 block text-xs font-medium text-slate-600">Bobot kriteria</label>
                                <input
                                  id={`criterion-weight-${questionIndex}-${criterionIndex}`}
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={criterion.weight}
                                  onChange={(event) => updateDraftCriterion(questionIndex, criterionIndex, "weight", event.target.value)}
                                  required
                                  className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-700 focus:ring-2 focus:ring-sky-100"
                                />
                              </div>
                              <div className="flex justify-end sm:pt-5">
                                <button
                                  type="button"
                                  onClick={() => removeCriterion(questionIndex, criterionIndex)}
                                  disabled={question.criteria.length === 1}
                                  aria-label={`Hapus kriteria ${criterionIndex + 1} dari soal ${questionIndex + 1}`}
                                  className="inline-flex min-h-9 items-center rounded-md px-3 text-sm text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                  Hapus
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  ))}
                </div>

                <div className="flex flex-col justify-between gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center">
                  <p className="max-w-2xl text-xs leading-5 text-slate-500">Kriteria berbobot 0 tetap memberikan feedback. Bobot positif pada soal dan rubrik digunakan untuk menghitung nilai akhir.</p>
                  <button
                    type="submit"
                    disabled={savingExam}
                    className={buttonClass("primary", "min-h-11 px-5 py-2.5")}
                  >
                    {savingExam ? "Membuat ujian…" : "Buat ujian"}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="space-y-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Daftar</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Daftar ujian <span className="ml-1 text-sm font-normal text-slate-500">({exams.length})</span></h2>
                <p className="mt-1 text-sm text-slate-600">Buka detail ujian untuk melihat bobot tiap soal dan mengatur ulang bobot rubrik.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  void loadExams();
                }}
                disabled={loading}
                className={buttonClass("secondary", "min-h-9 self-start px-3.5 py-2 font-medium sm:self-auto")}
              >
                {loading ? "Memuat…" : "Muat ulang"}
              </button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="exam-search" className="sr-only">Cari ujian</label>
              <input
                id="exam-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Cari judul, pertanyaan, atau rubrik…"
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-sky-700 focus:ring-2 focus:ring-sky-100"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className={buttonClass("ghost", "min-h-11 shrink-0 px-3 font-medium")}
                >
                  Hapus pencarian
                </button>
              )}
            </div>

            {loading && exams.length === 0 ? (
              <div role="status" className="border-y border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">Memuat ujian…</div>
            ) : exams.length === 0 ? (
              <div className="border-y border-slate-200 bg-white px-5 py-10 text-center">
                <h3 className="font-semibold text-slate-900">Belum ada ujian</h3>
                <p className="mt-1 text-sm text-slate-600">Buat ujian pertama untuk mulai menyusun soal dan rubrik.</p>
                <button type="button" onClick={() => setShowCreateForm(true)} className={buttonClass("primary", "mt-4 px-4 py-2.5")}>Buat ujian</button>
              </div>
            ) : filteredExams.length === 0 ? (
              <div className="border-y border-slate-200 bg-white px-5 py-10 text-center">
                <h3 className="font-semibold text-slate-900">Tidak ada ujian yang cocok</h3>
                <p className="mt-1 text-sm text-slate-600">Coba kata kunci lain.</p>
                <button type="button" onClick={() => setSearchQuery("")} className={buttonClass("link", "mt-3")}>Hapus pencarian</button>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500">Menampilkan {filteredExams.length} dari {exams.length} ujian. Bobot soal dan rubrik tersedia pada detail.</p>
                <div className="space-y-4 lg:hidden">
                  {filteredExams.map((exam) => renderExamCard(exam, "mobile"))}
                </div>
                <div className="hidden items-start gap-4 lg:grid lg:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-4">
                    {filteredExams.filter((_, index) => index % 2 === 0).map((exam) => renderExamCard(exam, "desktop-left"))}
                  </div>
                  <div className="flex min-w-0 flex-col gap-4">
                    {filteredExams.filter((_, index) => index % 2 === 1).map((exam) => renderExamCard(exam, "desktop-right"))}
                  </div>
                </div>
              </>
            )}
          </section>

          <TeacherScoreProtests />
          <PageFooter role="teacher" />
        </div>
      </main>
    </RoleGuard>
  );
}
