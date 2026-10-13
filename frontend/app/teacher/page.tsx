"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

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
  if (!value) {
    return "Waktu tidak tersedia";
  }

  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function TeacherPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingExam, setSavingExam] = useState(false);
  const [savingCriterionId, setSavingCriterionId] = useState<number | null>(
    null,
  );

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [weightDrafts, setWeightDrafts] = useState<Record<number, string>>(
    {},
  );

  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [draftCriteria, setDraftCriteria] = useState<DraftCriterion[]>([
    { ...INITIAL_CRITERION },
  ]);

  const loadExams = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await listExams();

      setExams(data);
      setWeightDrafts(
        Object.fromEntries(
          data.flatMap((exam) =>
            exam.criteria.map((criterion) => [
              criterion.id,
              String(criterion.weight),
            ]),
          ),
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Tidak dapat mengambil data exam.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadExams();
  }, [loadExams]);

  function updateDraftCriterion(
    index: number,
    field: keyof DraftCriterion,
    value: string,
  ) {
    setDraftCriteria((current) =>
      current.map((criterion, currentIndex) =>
        currentIndex === index
          ? { ...criterion, [field]: value }
          : criterion,
      ),
    );
  }

  function addCriterion() {
    setDraftCriteria((current) => [
      ...current,
      { ...INITIAL_CRITERION, weight: "0" },
    ]);
  }

  function removeCriterion(index: number) {
    setDraftCriteria((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
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
      setError(
        "Lengkapi semua kriteria dan pastikan bobot tidak negatif.",
      );
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
      setNotice(`Exam "${created.title}" berhasil dibuat.`);

      await loadExams();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal membuat exam.",
      );
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
      await updateCriterionWeight(
        examId,
        criterionId,
        Number(rawWeight),
      );

      setNotice("Bobot kriteria berhasil diperbarui.");
      await loadExams();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memperbarui bobot.",
      );
    } finally {
      setSavingCriterionId(null);
    }
  }

  const criterionCount = exams.reduce(
    (total, exam) => total + exam.criteria.length,
    0,
  );

  const activeCriterionCount = exams.reduce(
    (total, exam) =>
      total +
      exam.criteria.filter((criterion) => criterion.weight > 0).length,
    0,
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div>
            <p className="text-sm font-semibold tracking-wide text-blue-700">
              ESSAY SCORING
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Teacher Dashboard
            </h1>
          </div>

          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">
            Teacher workspace
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-8">
        <section>
          <p className="text-sm font-medium text-blue-700">
            RUBRIC MANAGEMENT
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">
            Kelola exam dan penilaian essay
          </h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            Buat pertanyaan essay, tentukan kriteria penilaian, lalu atur
            bobot sesuai materi yang sudah diajarkan. Kriteria dengan
            bobot nol tetap dapat memberikan feedback kepada siswa.
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

        {notice && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            {notice}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total exams" value={exams.length} />
          <StatCard label="Total rubric criteria" value={criterionCount} />
          <StatCard
            label="Kriteria berbobot aktif"
            value={activeCriterionCount}
          />
        </section>

        <section
          id="create-exam"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
        >
          <div className="mb-6">
            <h2 className="text-xl font-bold">Buat exam baru</h2>
            <p className="mt-1 text-sm text-slate-600">
              Setiap kriteria memiliki skor maksimum 100. Bobot dapat
              diubah lagi setelah exam dibuat.
            </p>
          </div>

          <form onSubmit={handleCreateExam} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="exam-title"
                  className="mb-2 block text-sm font-semibold"
                >
                  Judul exam
                </label>
                <input
                  id="exam-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  maxLength={200}
                  placeholder="Contoh: Machine Learning Fundamentals"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="exam-question"
                  className="mb-2 block text-sm font-semibold"
                >
                  Pertanyaan essay
                </label>
                <textarea
                  id="exam-question"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  required
                  rows={3}
                  placeholder="Tuliskan pertanyaan essay untuk siswa..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">Rubric criteria</h3>
                <button
                  type="button"
                  onClick={addCriterion}
                  className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                >
                  + Tambah kriteria
                </button>
              </div>

              {draftCriteria.map((criterion, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1.5fr_110px_auto]"
                >
                  <div>
                    <label
                      htmlFor={`criterion-label-${index}`}
                      className="mb-1.5 block text-xs font-semibold text-slate-600"
                    >
                      Nama kriteria
                    </label>
                    <input
                      id={`criterion-label-${index}`}
                      value={criterion.label}
                      onChange={(event) =>
                        updateDraftCriterion(
                          index,
                          "label",
                          event.target.value,
                        )
                      }
                      required
                      maxLength={200}
                      placeholder="Definisi konsep"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`criterion-description-${index}`}
                      className="mb-1.5 block text-xs font-semibold text-slate-600"
                    >
                      Deskripsi penilaian
                    </label>
                    <input
                      id={`criterion-description-${index}`}
                      value={criterion.description}
                      onChange={(event) =>
                        updateDraftCriterion(
                          index,
                          "description",
                          event.target.value,
                        )
                      }
                      required
                      placeholder="Apa yang harus ditunjukkan siswa?"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`criterion-weight-${index}`}
                      className="mb-1.5 block text-xs font-semibold text-slate-600"
                    >
                      Bobot
                    </label>
                    <input
                      id={`criterion-weight-${index}`}
                      type="number"
                      min="0"
                      step="0.1"
                      value={criterion.weight}
                      onChange={(event) =>
                        updateDraftCriterion(
                          index,
                          "weight",
                          event.target.value,
                        )
                      }
                      required
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removeCriterion(index)}
                      disabled={draftCriteria.length === 1}
                      className="w-full rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-white hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label={`Hapus kriteria ${index + 1}`}
                      title="Hapus kriteria"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
              <p className="max-w-xl text-sm text-slate-500">
                Total bobot tidak harus 100. Nilai akhir dinormalisasi
                menggunakan jumlah bobot aktif.
              </p>

              <button
                type="submit"
                disabled={savingExam}
                className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingExam ? "Menyimpan..." : "Buat exam"}
              </button>
            </div>
          </form>
        </section>

        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">Exam yang tersimpan</h2>
              <p className="mt-1 text-sm text-slate-600">
                Data diambil langsung dari backend.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadExams()}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50"
            >
              {loading ? "Memuat..." : "Refresh"}
            </button>
          </div>

          {loading && exams.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
              Memuat exam...
            </div>
          ) : exams.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <h3 className="font-semibold">Belum ada exam</h3>
              <p className="mt-2 text-sm text-slate-600">
                Buat exam pertama menggunakan form di atas.
              </p>
            </div>
          ) : (
            exams.map((exam) => {
              const totalWeight = exam.criteria.reduce(
                (total, criterion) =>
                  total +
                  Number(
                    weightDrafts[criterion.id] ?? criterion.weight,
                  ),
                0,
              );

              return (
                <article
                  key={exam.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="border-b border-slate-200 p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                          Exam #{exam.id}
                        </p>
                        <h3 className="mt-1 text-lg font-bold">
                          {exam.title}
                        </h3>
                        <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-600">
                          {exam.question}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
                        {formatDate(exam.created_at)}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3 text-sm">
                      <span className="rounded-lg bg-slate-100 px-3 py-2">
                        {exam.criteria.length} kriteria
                      </span>
                      <span className="rounded-lg bg-blue-50 px-3 py-2 font-medium text-blue-800">
                        Total bobot: {Number.isFinite(totalWeight)
                          ? Number(totalWeight.toFixed(2))
                          : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {exam.criteria.map((criterion) => (
                      <div
                        key={criterion.id}
                        className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold">
                            {criterion.label}
                          </h4>
                          <p className="mt-1 text-sm leading-5 text-slate-600">
                            {criterion.description}
                          </p>

                          {criterion.weight === 0 && (
                            <span className="mt-2 inline-block rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                              Feedback only · tidak dihitung
                            </span>
                          )}
                        </div>

                        <div className="flex items-end gap-2">
                          <div>
                            <label
                              htmlFor={`weight-${criterion.id}`}
                              className="mb-1.5 block text-xs font-medium text-slate-600"
                            >
                              Bobot
                            </label>
                            <input
                              id={`weight-${criterion.id}`}
                              type="number"
                              min="0"
                              step="0.1"
                              value={
                                weightDrafts[criterion.id] ??
                                String(criterion.weight)
                              }
                              onChange={(event) =>
                                setWeightDrafts((current) => ({
                                  ...current,
                                  [criterion.id]: event.target.value,
                                }))
                              }
                              className="w-28 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              void saveWeight(exam.id, criterion.id)
                            }
                            disabled={savingCriterionId === criterion.id}
                            className="rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingCriterionId === criterion.id
                              ? "Menyimpan..."
                              : "Simpan"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}