
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
import { getClassDetail, type SchoolClassDetail } from "@/lib/api";

function scoreLabel(score: number | null): string {
  return score === null ? "—" : `${score.toFixed(2)}`;
}

function TeacherClassDetailContent() {
  const params = useParams<{ classId: string }>();
  const classId = Number(params.classId);
  const isValidClassId = Number.isInteger(classId) && classId > 0;

  const [classroom, setClassroom] = useState<SchoolClassDetail | null>(null);
  const [loading, setLoading] = useState(isValidClassId);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!isValidClassId) return;

    let cancelled = false;

    async function fetchClass() {
        try {
        const result = await getClassDetail(classId);

        if (cancelled) return;

        setClassroom(result);
        setError("");
        } catch (err) {
        if (cancelled) return;

        setError(
            err instanceof Error
            ? err.message
            : "Tidak dapat memuat detail kelas.",
        );
        } finally {
        if (!cancelled) {
            setLoading(false);
        }
        }
    }

    void fetchClass();

    return () => {
        cancelled = true;
    };
    }, [classId, isValidClassId]);

  async function copyInviteCode() {
    if (!classroom) return;

    try {
      await navigator.clipboard.writeText(classroom.invite_code);
      setNotice("Kode undangan berhasil disalin.");
    } catch {
      setNotice(
        `Kode undangan kelas: ${classroom.invite_code}. Salin secara manual.`,
      );
    }
  }

  const displayedError = isValidClassId
    ? error
    : "Alamat kelas tidak valid.";

  const currentClassroom =
    classroom?.id === classId ? classroom : null;

  return (
    <RoleGuard requiredRole="teacher">
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <AppHeader page="teacher" />

        <div className="mx-auto max-w-7xl space-y-6 px-5 py-7 sm:px-8 lg:py-9">
          <PageHeader
            role="teacher"
            title={currentClassroom?.name ?? "Detail kelas"}
            description="Pantau siswa dan ujian yang dikaitkan dengan kelas ini."
            backHref="/teacher/classes"
            backLabel="← Daftar kelas"
          />

          {displayedError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {displayedError}
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

          {loading ? (
            <div
              role="status"
              className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500"
            >
              Memuat detail kelas...
            </div>
          ) : currentClassroom ? (
            <>
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: "Jumlah siswa",
                    value: currentClassroom.student_count,
                  },
                  {
                    label: "Jumlah ujian",
                    value: currentClassroom.exam_count,
                  },
                  {
                    label: "Rata-rata nilai",
                    value: scoreLabel(currentClassroom.average_score),
                  },
                  {
                    label: "Kode kelas",
                    value: currentClassroom.invite_code,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-200 bg-white p-5"
                  >
                    <p className="text-sm text-slate-500">{item.label}</p>

                    <p className="mt-2 break-words text-2xl font-semibold tabular-nums text-slate-950">
                      {item.value}
                    </p>

                    {item.label === "Kode kelas" && (
                      <button
                        type="button"
                        onClick={() => void copyInviteCode()}
                        className={buttonClass(
                          "secondary",
                          "mt-3 px-3 py-1.5 text-xs",
                        )}
                      >
                        Salin kode
                      </button>
                    )}
                  </div>
                ))}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 p-5">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      Daftar siswa
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Pilih siswa untuk melihat rata-rata nilai, riwayat ujian,
                      jawaban, dan umpan balik penilaian.
                    </p>
                  </div>

                  <span className="text-sm text-slate-500">
                    {currentClassroom.students.length} siswa
                  </span>
                </div>

                {currentClassroom.students.length === 0 ? (
                  <p className="p-8 text-center text-sm text-slate-500">
                    Belum ada siswa yang bergabung. Bagikan kode undangan di
                    atas.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-5 py-3 font-medium">
                            Nama siswa
                          </th>
                          <th className="px-5 py-3 font-medium">Email</th>
                          <th className="px-5 py-3 font-medium">
                            Ujian selesai
                          </th>
                          <th className="px-5 py-3 font-medium">
                            Rata-rata
                          </th>
                          <th className="px-5 py-3 font-medium"> </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {currentClassroom.students.map((student) => (
                          <tr
                            key={student.id}
                            className="hover:bg-slate-50"
                          >
                            <td className="px-5 py-4 font-medium text-slate-900">
                              {student.name}
                            </td>
                            <td className="px-5 py-4 text-slate-600">
                              {student.email}
                            </td>
                            <td className="px-5 py-4 tabular-nums">
                              {student.completed_exams}
                            </td>
                            <td className="px-5 py-4 tabular-nums">
                              {scoreLabel(student.average_score)}
                            </td>
                            <td className="px-5 py-4">
                              <Link
                                className="font-semibold text-sky-700 hover:underline"
                                href={`/teacher/classes/${currentClassroom.id}/students/${student.id}`}
                              >
                                Lihat performa →
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 p-5">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      Ujian kelas
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Ringkasan penyelesaian ujian dan rata-rata nilai kelas.
                    </p>
                  </div>

                  <Link
                    href="/teacher/exams"
                    className={buttonClass("primary", "px-4 py-2")}
                  >
                    Kelola ujian
                  </Link>
                </div>

                {currentClassroom.exams.length === 0 ? (
                  <p className="p-8 text-center text-sm text-slate-500">
                    Belum ada ujian yang dikaitkan dengan kelas ini. Buat ujian
                    dari halaman Kelola Ujian dan pilih kelas ini.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {currentClassroom.exams.map((exam) => (
                      <div
                        key={exam.id}
                        className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"
                      >
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            {exam.title}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            #{exam.id} · {exam.duration_minutes} menit · Dibuat{" "}
                            {formatDate(exam.created_at)}
                          </p>
                        </div>

                        <div className="flex gap-6 text-sm">
                          <div>
                            <p className="text-xs text-slate-500">
                              Siswa selesai
                            </p>
                            <p className="mt-1 font-semibold tabular-nums">
                              {exam.completed_students}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Rata-rata</p>
                            <p className="mt-1 font-semibold tabular-nums">
                              {scoreLabel(exam.average_score)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}

          <PageFooter role="teacher" />
        </div>
      </main>
    </RoleGuard>
  );
}

export default function TeacherClassDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-600">
          Memuat detail kelas...
        </main>
      }
    >
      <TeacherClassDetailContent />
    </Suspense>
  );
}
