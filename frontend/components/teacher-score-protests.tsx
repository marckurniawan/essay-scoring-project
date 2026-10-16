
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getScoreProtests,
  reviewScoreProtest,
  type ScoreProtest,
  type ScoreProtestReviewInput,
} from "@/lib/api";
import { formatDate } from "@/lib/formatDate";
import { buttonClass } from "./ui/button";

type ReviewDraft = {
  teacherFeedback: string;
  reviewedScore: string;
};

type ReviewDecision = "accepted" | "rejected";

function formatScore(value: number | null): string {
  if (value === null) return "Tidak tersedia";

  return `${Number(value.toFixed(2))}/100`;
}

function getStatusStyle(status: ScoreProtest["status"]): string {
  switch (status) {
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "accepted":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "rejected":
      return "border-red-200 bg-red-50 text-red-800";
  }
}

function getStatusLabel(status: ScoreProtest["status"]): string {
  switch (status) {
    case "pending":
      return "Menunggu";
    case "accepted":
      return "Diterima";
    case "rejected":
      return "Ditolak";
  }
}

export default function TeacherScoreProtests() {
  const [protests, setProtests] = useState<ScoreProtest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingProtestId, setSavingProtestId] = useState<number | null>(null);

  const [drafts, setDrafts] = useState<Record<number, ReviewDraft>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;

    getScoreProtests()
      .then((data) => {
        if (!cancelled) {
          setProtests(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Gagal memuat protes nilai.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshProtests = useCallback(async () => {
    setRefreshing(true);
    setError("");
    setNotice("");

    try {
      const data = await getScoreProtests();
      setProtests(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memuat ulang protes nilai.",
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  function updateDraft(
    protestId: number,
    field: keyof ReviewDraft,
    value: string,
    protest: ScoreProtest,
  ) {
    setDrafts((current) => {
      const existing = current[protestId];

      return {
        ...current,
        [protestId]: {
          teacherFeedback:
            existing?.teacherFeedback ??
            protest.teacher_feedback ??
            "",
          reviewedScore:
            existing?.reviewedScore ??
            (protest.reviewed_score === null
              ? protest.original_score === null
                ? ""
                : String(protest.original_score)
              : String(protest.reviewed_score)),
          [field]: value,
        },
      };
    });
  }

  async function handleReview(
    protest: ScoreProtest,
    decision: ReviewDecision,
  ) {
    const draft = drafts[protest.id];

    const teacherFeedback = (
      draft?.teacherFeedback ??
      protest.teacher_feedback ??
      ""
    ).trim();

    if (!teacherFeedback) {
      setError(
        `Isi umpan balik untuk protes #${protest.id} terlebih dahulu.`,
      );
      setNotice("");
      return;
    }

    let payload: ScoreProtestReviewInput;

    if (decision === "accepted") {
      const rawScore =
        draft?.reviewedScore ??
        (protest.original_score === null
          ? ""
          : String(protest.original_score));

      const reviewedScore = Number(rawScore);

      if (
        rawScore.trim() === "" ||
        !Number.isFinite(reviewedScore) ||
        reviewedScore < 0 ||
        reviewedScore > 100
      ) {
        setError(
          "Nilai hasil tinjauan harus berupa angka antara 0 dan 100.",
        );
        setNotice("");
        return;
      }

      payload = {
        status: "accepted",
        teacher_feedback: teacherFeedback,
        reviewed_score: reviewedScore,
      };
    } else {
      payload = {
        status: "rejected",
        teacher_feedback: teacherFeedback,
      };
    }

    setSavingProtestId(protest.id);
    setError("");
    setNotice("");

    try {
      const updatedProtest = await reviewScoreProtest(
        protest.id,
        payload,
      );

      setProtests((current) =>
        current.map((item) =>
          item.id === updatedProtest.id
            ? updatedProtest
            : item,
        ),
      );

      setNotice(
        `Protes #${protest.id} telah ${decision === "accepted" ? "diterima" : "ditolak"}.`,
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : `Gagal memproses protes #${protest.id}.`,
      );
    } finally {
      setSavingProtestId(null);
    }
  }

  const pendingCount = protests.filter(
    (protest) => protest.status === "pending",
  ).length;

  const resolvedCount = protests.length - pendingCount;

  const sortedProtests = [...protests].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;

    const dateA = a.created_at
      ? new Date(a.created_at).getTime()
      : 0;
    const dateB = b.created_at
      ? new Date(b.created_at).getTime()
      : 0;

    return dateB - dateA;
  });

  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">
            Protes nilai siswa
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Tinjau setiap permintaan dan berikan keputusan yang jelas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshProtests()}
          disabled={loading || refreshing}
          className={buttonClass("secondary", "px-4 py-2 font-medium")}
        >
          {refreshing ? "Memuat ulang..." : "Muat ulang"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Total protes</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
            {protests.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Menunggu tinjauan</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-amber-700">
            {pendingCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Sudah diselesaikan</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-700">
            {resolvedCount}
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {notice}
        </div>
      )}

      {loading ? (
        <div
          role="status"
          className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500"
        >
          Memuat protes nilai...
        </div>
      ) : protests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
          <h3 className="font-semibold text-slate-900">
            Belum ada protes nilai
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Permintaan protes dari siswa akan muncul di sini.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Menampilkan {protests.length} protes. Permintaan yang menunggu
            ditampilkan lebih dulu. Buka sebuah protes untuk melihat detail
            dan meninjaunya.
          </p>

          {sortedProtests.map((protest) => {
            const draft = drafts[protest.id];

            const teacherFeedback =
              draft?.teacherFeedback ??
              protest.teacher_feedback ??
              "";

            const reviewedScore =
              draft?.reviewedScore ??
              (protest.reviewed_score === null
                ? protest.original_score === null
                  ? ""
                  : String(protest.original_score)
                : String(protest.reviewed_score));

            const isSaving = savingProtestId === protest.id;
            const isResolved = protest.status !== "pending";

            return (
              <details
                key={protest.id}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 transition hover:bg-slate-50 sm:p-5 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                        Protes #{protest.id}
                      </span>

                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusStyle(protest.status)}`}
                      >
                        {getStatusLabel(protest.status)}
                      </span>
                    </div>

                    <h3 className="mt-2 break-words text-sm font-semibold text-slate-900 sm:text-base">
                      {protest.exam_title ?? `Pengerjaan #${protest.submission_id}`}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {protest.student_name ?? `Siswa #${protest.student_id}`} · {protest.class_name ?? "Kelas belum tersedia"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">
                      {protest.reason}
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      Diajukan: {formatDate(protest.created_at)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="hidden rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 group-open:hidden sm:inline-flex">
                      Lihat detail
                    </span>

                    <span className="hidden rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 group-open:inline-flex">
                      Sembunyikan detail
                    </span>

                    <span
                      aria-hidden="true"
                      className="text-slate-500 transition-transform group-open:rotate-180"
                    >
                      ↓
                    </span>
                  </div>
                </summary>

                <div className="space-y-5 border-t border-slate-200 p-4 sm:p-5">
                  <section>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Informasi protes
                    </h4>

                    <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">Siswa</dt>
                        <dd className="mt-1 text-sm font-medium text-slate-900">
                          {protest.student_name ?? `Siswa #${protest.student_id}`}
                        </dd>
                        {protest.student_email && <dd className="mt-1 break-all text-xs text-slate-500">{protest.student_email}</dd>}
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">Kelas</dt>
                        <dd className="mt-1 text-sm font-medium text-slate-900">
                          {protest.class_name ?? "Belum dikaitkan ke kelas"}
                        </dd>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">Ujian</dt>
                        <dd className="mt-1 text-sm font-medium text-slate-900">
                          {protest.exam_title ?? `Ujian #${protest.exam_id ?? protest.submission_id}`}
                        </dd>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">
                          ID pengumpulan
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-900">
                          #{protest.submission_id}
                        </dd>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">
                          ID Kriteria
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-900">
                          {protest.criterion_id === null
                            ? "Nilai keseluruhan"
                            : `#${protest.criterion_id}`}
                        </dd>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">
                          Diajukan pada
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-900">
                          {formatDate(protest.created_at)}
                        </dd>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">
                          Nilai awal
                        </dt>
                        <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                          {formatScore(protest.original_score)}
                        </dd>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">
                          Nilai hasil tinjauan
                        </dt>
                        <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                          {formatScore(protest.reviewed_score)}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Alasan siswa
                    </h4>

                    <div className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                      {protest.reason}
                    </div>
                  </section>

                  {isResolved && (
                    <section>
                      <h4 className="text-sm font-semibold text-slate-900">
                        Hasil tinjauan
                      </h4>

                      <div className="mt-2 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">
                          Keputusan:{" "}
                          <span className="font-semibold text-slate-900">
                            {getStatusLabel(protest.status)}
                          </span>
                        </p>

                        <div>
                          <p className="text-xs font-medium text-slate-500">
                            Umpan balik guru
                          </p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                            {protest.teacher_feedback ||
                              "Tidak ada umpan balik."}
                          </p>
                        </div>

                        <p className="text-xs text-slate-500">
                          Ditinjau pada: {formatDate(protest.reviewed_at)}
                        </p>

                        {protest.reviewed_by !== null && (
                          <p className="text-xs text-slate-500">
                            Ditinjau oleh guru #{protest.reviewed_by}
                          </p>
                        )}
                      </div>
                    </section>
                  )}

                  {!isResolved && (
                    <section>
                      <div className="border-t border-slate-200 pt-5">
                        <h4 className="text-sm font-semibold text-slate-900">
                          Tinjau protes ini
                        </h4>

                        <p className="mt-1 text-sm leading-5 text-slate-500">
                          Berikan umpan balik dan pilih untuk menerima atau
                          menolak permintaan siswa.
                        </p>
                      </div>

                      <div className="mt-4 space-y-4">
                        <div>
                          <label
                            htmlFor={`teacher-feedback-${protest.id}`}
                            className="mb-1.5 block text-sm font-medium text-slate-700"
                          >
                            Umpan balik guru
                          </label>

                          <textarea
                            id={`teacher-feedback-${protest.id}`}
                            value={teacherFeedback}
                            onChange={(event) =>
                              updateDraft(
                                protest.id,
                                "teacherFeedback",
                                event.target.value,
                                protest,
                              )
                            }
                            placeholder="Jelaskan keputusanmu kepada siswa..."
                            rows={4}
                            disabled={savingProtestId !== null}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`score-${protest.id}`}
                            className="mb-1.5 block text-sm font-medium text-slate-700"
                          >
                            Nilai revisi
                          </label>

                          <input
                            id={`score-${protest.id}`}
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            value={reviewedScore}
                            onChange={(event) =>
                              updateDraft(
                                protest.id,
                                "reviewedScore",
                                event.target.value,
                                protest,
                              )
                            }
                            disabled={savingProtestId !== null}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50 sm:max-w-xs"
                          />

                          <p className="mt-1.5 text-xs leading-5 text-slate-500">
                            Dipakai saat protes diterima. Nilai harus di
                            antara 0 dan 100.
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
                          <button
                            type="button"
                            onClick={() =>
                              void handleReview(protest, "accepted")
                            }
                            disabled={savingProtestId !== null}
                            className={buttonClass("success", "px-4 py-2.5")}
                          >
                            {isSaving ? "Menyimpan..." : "Terima protes"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleReview(protest, "rejected")
                            }
                            disabled={savingProtestId !== null}
                            className={buttonClass("dangerOutline", "px-4 py-2.5")}
                          >
                            {isSaving ? "Menyimpan..." : "Tolak protes"}
                          </button>
                        </div>
                      </div>
                    </section>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
