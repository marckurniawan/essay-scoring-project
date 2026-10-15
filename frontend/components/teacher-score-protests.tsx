
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getScoreProtests,
  reviewScoreProtest,
  type ScoreProtest,
  type ScoreProtestReviewInput,
} from "@/lib/api";

type ReviewDraft = {
  teacherFeedback: string;
  reviewedScore: string;
};

type ReviewDecision = "accepted" | "rejected";

function formatDate(value: string | null): string {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatScore(value: number | null): string {
  if (value === null) return "Not available";

  return `${Number(value.toFixed(2))}/100`;
}

function getStatusStyle(status: ScoreProtest["status"]): string {
  switch (status) {
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "accepted":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "rejected":
      return "border-rose-200 bg-rose-50 text-rose-800";
  }
}

function getStatusLabel(status: ScoreProtest["status"]): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
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
              : "Unable to load score protests.",
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
          : "Unable to refresh score protests.",
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
        `Please provide teacher feedback for protest #${protest.id}.`,
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
          "The reviewed score must be a number between 0 and 100.",
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
        `Protest #${protest.id} has been ${decision}.`,
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : `Unable to review protest #${protest.id}.`,
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
            Student score protests
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Review each request and provide a clear decision.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshProtests()}
          disabled={loading || refreshing}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Total protests</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
            {protests.length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Awaiting review</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-amber-700">
            {pendingCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Resolved</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-700">
            {resolvedCount}
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
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
          className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500"
        >
          Loading score protests...
        </div>
      ) : protests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
          <h3 className="font-semibold text-slate-900">
            No score protests yet
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Student protest requests will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Showing {protests.length} protests. Pending requests appear first.
            Open a protest to view its details and review actions.
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
                className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 transition hover:bg-slate-50 sm:p-5 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                        Protest #{protest.id}
                      </span>

                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusStyle(protest.status)}`}
                      >
                        {getStatusLabel(protest.status)}
                      </span>
                    </div>

                    <h3 className="mt-2 break-words text-sm font-semibold text-slate-900 sm:text-base">
                      Submission #{protest.submission_id}
                    </h3>

                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">
                      {protest.reason}
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      Submitted: {formatDate(protest.created_at)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="hidden rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 group-open:hidden sm:inline-flex">
                      Show details
                    </span>

                    <span className="hidden rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 group-open:inline-flex">
                      Hide details
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
                      Protest information
                    </h4>

                    <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">
                          Student ID
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-900">
                          #{protest.student_id}
                        </dd>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">
                          Submission ID
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-900">
                          #{protest.submission_id}
                        </dd>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">
                          Criterion ID
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-900">
                          {protest.criterion_id === null
                            ? "General score"
                            : `#${protest.criterion_id}`}
                        </dd>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">
                          Submitted at
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-900">
                          {formatDate(protest.created_at)}
                        </dd>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">
                          Original score
                        </dt>
                        <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                          {formatScore(protest.original_score)}
                        </dd>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">
                          Reviewed score
                        </dt>
                        <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                          {formatScore(protest.reviewed_score)}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Student&apos;s reason
                    </h4>

                    <div className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                      {protest.reason}
                    </div>
                  </section>

                  {isResolved && (
                    <section>
                      <h4 className="text-sm font-semibold text-slate-900">
                        Review result
                      </h4>

                      <div className="mt-2 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">
                          Decision:{" "}
                          <span className="font-semibold text-slate-900">
                            {getStatusLabel(protest.status)}
                          </span>
                        </p>

                        <div>
                          <p className="text-xs font-medium text-slate-500">
                            Teacher feedback
                          </p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                            {protest.teacher_feedback ||
                              "No feedback provided."}
                          </p>
                        </div>

                        <p className="text-xs text-slate-500">
                          Reviewed at: {formatDate(protest.reviewed_at)}
                        </p>

                        {protest.reviewed_by !== null && (
                          <p className="text-xs text-slate-500">
                            Reviewed by teacher #{protest.reviewed_by}
                          </p>
                        )}
                      </div>
                    </section>
                  )}

                  {!isResolved && (
                    <section>
                      <div className="border-t border-slate-200 pt-5">
                        <h4 className="text-sm font-semibold text-slate-900">
                          Review this protest
                        </h4>

                        <p className="mt-1 text-sm leading-5 text-slate-500">
                          Provide feedback and choose whether to accept or
                          reject the student&apos;s request.
                        </p>
                      </div>

                      <div className="mt-4 space-y-4">
                        <div>
                          <label
                            htmlFor={`feedback-${protest.id}`}
                            className="mb-1.5 block text-sm font-medium text-slate-700"
                          >
                            Teacher feedback
                          </label>

                          <textarea
                            id={`feedback-${protest.id}`}
                            value={teacherFeedback}
                            onChange={(event) =>
                              updateDraft(
                                protest.id,
                                "teacherFeedback",
                                event.target.value,
                                protest,
                              )
                            }
                            placeholder="Explain your decision to the student..."
                            rows={4}
                            disabled={savingProtestId !== null}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`score-${protest.id}`}
                            className="mb-1.5 block text-sm font-medium text-slate-700"
                          >
                            Revised score
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
                            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 sm:max-w-xs"
                          />

                          <p className="mt-1.5 text-xs leading-5 text-slate-500">
                            Used when accepting the protest. The score must
                            be between 0 and 100.
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
                          <button
                            type="button"
                            onClick={() =>
                              void handleReview(protest, "accepted")
                            }
                            disabled={savingProtestId !== null}
                            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isSaving ? "Saving..." : "Accept protest"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleReview(protest, "rejected")
                            }
                            disabled={savingProtestId !== null}
                            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isSaving ? "Saving..." : "Reject protest"}
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
