"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import AppHeader from "@/components/AppHeader";
import {
  createExam,
  listExams,
  updateCriterionWeight,
  type Exam,
} from "@/lib/api";

type DraftCriterion = {
  label: string;
  description: string;
  weight: string;
};

const INITIAL_CRITERION: DraftCriterion = {
  label: "",
  description: "",
  weight: "20",
};

function formatDate(value: string | null): string {
  if (!value) return "Tanggal tidak tersedia";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak tersedia";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function TeacherPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingExam, setSavingExam] = useState(false);
  const [savingCriterionId, setSavingCriterionId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [weightDrafts, setWeightDrafts] = useState<Record<number, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedExamId, setExpandedExamId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCriterionId, setEditingCriterionId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [draftCriteria, setDraftCriteria] = useState<DraftCriterion[]>([
    { ...INITIAL_CRITERION },
  ]);

  const applyExams = useCallback((data: Exam[]) => {
    setExams(data);
    setWeightDrafts(
      Object.fromEntries(
        data.flatMap((exam) =>
          exam.criteria.map((criterion) => [criterion.id, String(criterion.weight)]),
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
      setError(err instanceof Error ? err.message : "Tidak dapat mengambil data exam.");
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
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Tidak dapat mengambil data exam.");
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

  function updateDraftCriterion(index: number, field: keyof DraftCriterion, value: string) {
    setDraftCriteria((current) =>
      current.map((criterion, currentIndex) =>
        currentIndex === index ? { ...criterion, [field]: value } : criterion,
      ),
    );
  }

  function addCriterion() {
    setDraftCriteria((current) => [...current, { ...INITIAL_CRITERION, weight: "0" }]);
  }

  function removeCriterion(index: number) {
    setDraftCriteria((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  async function handleCreateExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!title.trim() || !question.trim()) {
      setError("Judul dan pertanyaan harus diisi.");
      return;
    }
    if (draftCriteria.length === 0) {
      setError("Tambahkan minimal satu kriteria.");
      return;
    }

    const invalidCriterion = draftCriteria.some(
      (criterion) =>
        !criterion.label.trim() ||
        !criterion.description.trim() ||
        criterion.weight.trim() === "" ||
        !Number.isFinite(Number(criterion.weight)) ||
        Number(criterion.weight) < 0,
    );

    if (invalidCriterion) {
      setError("Lengkapi semua kriteria dan pastikan bobot tidak negatif.");
      return;
    }

    setSavingExam(true);
    try {
      const created = await createExam({
        title: title.trim(),
        question: question.trim(),
        criteria: draftCriteria.map((criterion) => ({
          label: criterion.label.trim(),
          description: criterion.description.trim(),
          weight: Number(criterion.weight),
          max_score: 100,
        })),
      });

      setTitle("");
      setQuestion("");
      setDraftCriteria([{ ...INITIAL_CRITERION }]);
      setShowCreateForm(false);
      setExpandedExamId(created.id);
      setSearchQuery("");
      setNotice(`Exam “${created.title}” berhasil dibuat.`);
      setLoading(true);
      await loadExams();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat exam.");
    } finally {
      setSavingExam(false);
    }
  }

  async function saveWeight(examId: number, criterionId: number) {
    setError("");
    setNotice("");
    const rawWeight = weightDrafts[criterionId] ?? "";

    if (
      rawWeight.trim() === "" ||
      !Number.isFinite(Number(rawWeight)) ||
      Number(rawWeight) < 0
    ) {
      setError("Bobot harus berupa angka nol atau lebih.");
      return;
    }

    setSavingCriterionId(criterionId);
    try {
      const updated = await updateCriterionWeight(examId, criterionId, Number(rawWeight));
      setWeightDrafts((current) => ({ ...current, [criterionId]: String(updated.weight) }));
      setExams((current) =>
        current.map((exam) =>
          exam.id !== examId
            ? exam
            : {
                ...exam,
                criteria: exam.criteria.map((criterion) =>
                  criterion.id === criterionId ? { ...criterion, weight: updated.weight } : criterion,
                ),
              },
        ),
      );
      setEditingCriterionId(null);
      setNotice("Bobot kriteria berhasil diperbarui.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui bobot.");
    } finally {
      setSavingCriterionId(null);
    }
  }

  function renderExamCard(exam: Exam, layout: string) {
    const isExpanded = expandedExamId === exam.id;
    const totalWeight = exam.criteria.reduce(
      (total, criterion) => total + criterion.weight,
      0,
    );
    const activeCriteriaCount = exam.criteria.filter(
      (criterion) => criterion.weight > 0,
    ).length;

    return (
      <article key={`${layout}-${exam.id}`} className="min-w-0 break-inside-avoid border border-slate-200 bg-white">
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Exam #{exam.id}
            </p>
            <h3 className="mt-1 break-words text-base font-semibold tracking-tight text-slate-950">
              {exam.title}
            </h3>
            <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm leading-5 text-slate-600">
              {exam.question}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Created {formatDate(exam.created_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpandedExamId(isExpanded ? null : exam.id)}
            aria-expanded={isExpanded}
            aria-controls={`exam-detail-${layout}-${exam.id}`}
            className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            {isExpanded ? "Hide details" : "Show details"}
            <span aria-hidden="true">{isExpanded ? "−" : "+"}</span>
          </button>
        </div>

        {isExpanded && (
          <div
            id={`exam-detail-${layout}-${exam.id}`}
            className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5"
          >
            <div className="border-b border-slate-200 pb-4">
              <h4 className="text-sm font-semibold text-slate-900">Full question</h4>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {exam.question}
              </p>
            </div>

            <div className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200 py-4">
              <div className="pr-2">
                <p className="text-xs text-slate-500">Rubric criteria</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950">
                  {exam.criteria.length}
                </p>
              </div>
              <div className="px-2">
                <p className="text-xs text-slate-500">Active criteria</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950">
                  {activeCriteriaCount}
                </p>
              </div>
              <div className="pl-2">
                <p className="text-xs text-slate-500">Total weight</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950">
                  {Number.isFinite(totalWeight) ? Number(totalWeight.toFixed(2)) : "—"}
                </p>
              </div>
            </div>

            <div className="pt-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-900">Rubric and weights</h4>
                <span className="text-xs text-slate-500">Weight 0 = feedback only</span>
              </div>
              <div className="space-y-3">
                {exam.criteria.map((criterion) => {
                  const isEditingWeight = editingCriterionId === criterion.id;
                  const weightInputId = `weight-${layout}-${criterion.id}`;

                  return (
                    <div key={criterion.id} className="border border-slate-200 bg-white p-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h5 className="text-sm font-semibold text-slate-900">
                            {criterion.label}
                          </h5>
                          <p className="mt-1 text-sm leading-5 text-slate-600">
                            {criterion.description}
                          </p>
                        </div>
                        {criterion.weight === 0 && (
                          <span className="shrink-0 text-xs font-medium text-amber-800">
                            Feedback only
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                        {isEditingWeight ? (
                          <>
                            <div className="w-28">
                              <label
                                htmlFor={weightInputId}
                                className="mb-1 block text-xs font-medium text-slate-600"
                              >
                                Weight
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
                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void saveWeight(exam.id, criterion.id)}
                                disabled={savingCriterionId === criterion.id}
                                className="inline-flex min-h-9 items-center justify-center rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {savingCriterionId === criterion.id ? "Saving…" : "Save"}
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
                                className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:opacity-60"
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-slate-700">
                              Weight <span className="ml-1 font-semibold tabular-nums text-slate-950">{criterion.weight}</span>
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setWeightDrafts((current) => ({
                                  ...current,
                                  [criterion.id]: String(criterion.weight),
                                }));
                                setEditingCriterionId(criterion.id);
                                setError("");
                                setNotice("");
                              }}
                              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                            >
                              Edit weight
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </article>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader page="teacher" />

      <div className="mx-auto max-w-7xl space-y-8 px-5 py-7 sm:px-8 lg:py-9">
        <section className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Assessment workspace</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Manage exams and rubrics</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Buat assessment dan atur bobot rubric sesuai materi yang sudah diajarkan. Buka detail exam hanya saat kamu perlu mengubah kriterianya.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateForm((current) => !current)}
            aria-expanded={showCreateForm}
            aria-controls="create-exam-panel"
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          >
            {showCreateForm ? "Close form" : "+ Create an exam"}
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
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">New assessment</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Create an exam</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">Tambahkan pertanyaan, lalu tentukan kriteria yang ingin dinilai.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="self-start rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateExam} className="space-y-6">
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <label htmlFor="exam-title" className="mb-2 block text-sm font-medium text-slate-800">Exam title</label>
                  <input
                    id="exam-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                    maxLength={200}
                    placeholder="e.g. Machine Learning Fundamentals"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label htmlFor="exam-question" className="mb-2 block text-sm font-medium text-slate-800">Essay question</label>
                  <textarea
                    id="exam-question"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    required
                    rows={3}
                    placeholder="Write the question students will answer..."
                    className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-6 outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">Scoring criteria</h3>
                    <p className="mt-1 text-sm text-slate-500">Bobot bisa berbeda total dari 100; nilai akhir memakai total bobot aktif.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addCriterion}
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                  >
                    + Add criterion
                  </button>
                </div>

                <div className="space-y-3">
                  {draftCriteria.map((criterion, index) => (
                    <div key={index} className="grid gap-3 border border-slate-200 p-4 md:grid-cols-[minmax(140px,0.8fr)_minmax(220px,1.4fr)_100px_auto] md:items-start">
                      <div>
                        <label htmlFor={`criterion-label-${index}`} className="mb-1.5 block text-xs font-medium text-slate-600">Criterion</label>
                        <input
                          id={`criterion-label-${index}`}
                          value={criterion.label}
                          onChange={(event) => updateDraftCriterion(index, "label", event.target.value)}
                          required
                          maxLength={200}
                          placeholder="Criterion name"
                          className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label htmlFor={`criterion-description-${index}`} className="mb-1.5 block text-xs font-medium text-slate-600">Description</label>
                        <textarea
                          id={`criterion-description-${index}`}
                          value={criterion.description}
                          onChange={(event) => updateDraftCriterion(index, "description", event.target.value)}
                          required
                          rows={2}
                          placeholder="What should a strong answer demonstrate?"
                          className="w-full resize-y rounded-md border border-slate-300 px-3 py-2.5 text-sm leading-5 outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label htmlFor={`criterion-weight-${index}`} className="mb-1.5 block text-xs font-medium text-slate-600">Weight</label>
                        <input
                          id={`criterion-weight-${index}`}
                          type="number"
                          min="0"
                          step="0.1"
                          value={criterion.weight}
                          onChange={(event) => updateDraftCriterion(index, "weight", event.target.value)}
                          required
                          aria-label={`Weight for criterion ${index + 1}`}
                          className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div className="flex justify-end md:pt-6">
                        <button
                          type="button"
                          onClick={() => removeCriterion(index)}
                          disabled={draftCriteria.length === 1}
                          aria-label={`Remove criterion ${index + 1}`}
                          className="inline-flex min-h-9 items-center justify-center rounded-md px-3 text-sm text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col justify-between gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center">
                <p className="max-w-2xl text-xs leading-5 text-slate-500">Kriteria berbobot 0 tetap memberikan feedback, tetapi tidak memengaruhi nilai akhir.</p>
                <button
                  type="submit"
                  disabled={savingExam}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingExam ? "Creating exam…" : "Create exam"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="space-y-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Library</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Your exams <span className="ml-1 text-sm font-normal text-slate-500">({exams.length})</span></h2>
              <p className="mt-1 text-sm text-slate-600">Cari assessment, lalu buka detail jika ingin mengelola rubric.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void loadExams();
              }}
              disabled={loading}
              className="inline-flex min-h-9 items-center justify-center self-start rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:opacity-50 sm:self-auto"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="exam-search" className="sr-only">Search exams</label>
            <input
              id="exam-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by exam title, question, or rubric…"
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
              >
                Clear search
              </button>
            )}
          </div>

          {loading && exams.length === 0 ? (
            <div role="status" className="border-y border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">Loading exams…</div>
          ) : exams.length === 0 ? (
            <div className="border-y border-slate-200 bg-white px-5 py-10 text-center">
              <h3 className="font-semibold text-slate-900">No exams yet</h3>
              <p className="mt-1 text-sm text-slate-600">Buat exam pertama untuk mulai menyusun rubric.</p>
              <button type="button" onClick={() => setShowCreateForm(true)} className="mt-4 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700">Create an exam</button>
            </div>
          ) : filteredExams.length === 0 ? (
            <div className="border-y border-slate-200 bg-white px-5 py-10 text-center">
              <h3 className="font-semibold text-slate-900">No matching exams</h3>
              <p className="mt-1 text-sm text-slate-600">Coba kata kunci lain atau hapus filter pencarian.</p>
              <button type="button" onClick={() => setSearchQuery("")} className="mt-3 text-sm font-semibold text-blue-700 underline underline-offset-4">Clear search</button>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500">Showing {filteredExams.length} of {exams.length} exams. Detail rubric disembunyikan sampai exam dibuka.</p>
              <div className="space-y-4 lg:hidden">
                {filteredExams.map((exam) => renderExamCard(exam, "mobile"))}
              </div>
              <div className="hidden items-start gap-4 lg:grid lg:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-4">
                  {filteredExams
                    .filter((_, index) => index % 2 === 0)
                    .map((exam) => renderExamCard(exam, "desktop-left"))}
                </div>
                <div className="flex min-w-0 flex-col gap-4">
                  {filteredExams
                    .filter((_, index) => index % 2 === 1)
                    .map((exam) => renderExamCard(exam, "desktop-right"))}
                </div>
              </div>
            </>
          )}
        </section>

        <footer className="border-t border-slate-200 pt-4 text-xs text-slate-500">Essay Scoring · Teacher workspace</footer>
      </div>
    </main>
  );
}
