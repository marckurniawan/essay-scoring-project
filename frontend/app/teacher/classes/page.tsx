
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

import AppHeader from "@/components/AppHeader";
import PageFooter from "@/components/PageFooter";
import PageHeader from "@/components/PageHeader";
import RoleGuard from "@/components/role-guard";
import Badge from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/button";
import { createClass, listClasses, type SchoolClass } from "@/lib/api";

function scoreLabel(score: number | null): string {
  return score === null ? "Belum ada nilai" : `${score.toFixed(2)}/100`;
}

export default function TeacherClassesPage() {
  const [classrooms, setClassrooms] = useState<SchoolClass[]>([]);
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchClasses() {
      try {
        const classes = await listClasses();

        if (cancelled) return;

        setClassrooms(classes);
        setError("");
      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "Tidak dapat memuat kelas.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchClasses();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadClasses = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const classes = await listClasses();
      setClassrooms(classes);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Tidak dapat memuat kelas.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleCreateClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const normalizedName = className.trim();

    if (normalizedName.length < 2) {
      setError("Nama kelas harus memiliki minimal 2 karakter.");
      return;
    }

    setCreating(true);

    try {
      const created = await createClass(normalizedName);

      setClassrooms((current) => [created, ...current]);
      setClassName("");
      setNotice(
        `Kelas “${created.name}” berhasil dibuat. Bagikan kode undangannya kepada siswa.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal membuat kelas.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function copyInviteCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setNotice("Kode kelas berhasil disalin.");
    } catch {
      setNotice(`Kode kelas: ${code}. Salin kode ini secara manual.`);
    }
  }

  return (
    <RoleGuard requiredRole="teacher">
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <AppHeader page="teacher" />

        <div className="mx-auto max-w-7xl space-y-6 px-5 py-7 sm:px-8 lg:py-9">
          <PageHeader
            role="teacher"
            title="Kelola kelas"
            description="Buat kelas, bagikan kode undangan, dan pantau nilai serta perkembangan siswa di setiap kelas."
            backHref="/teacher"
          />

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {error}
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

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="mb-4">
              <Badge>Kelas baru</Badge>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">
                Buat kelas
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Setiap kelas akan mendapatkan kode undangan untuk pendaftaran
                siswa.
              </p>
            </div>

            <form
              onSubmit={handleCreateClass}
              className="flex flex-col gap-3 sm:flex-row"
            >
              <label htmlFor="class-name" className="sr-only">
                Nama kelas
              </label>

              <input
                id="class-name"
                type="text"
                value={className}
                onChange={(event) => setClassName(event.target.value)}
                required
                minLength={2}
                maxLength={120}
                placeholder="Contoh: AI Fundamentals - A"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
              />

              <button
                type="submit"
                disabled={creating}
                className={buttonClass("primary", "px-5 py-3")}
              >
                {creating ? "Membuat kelas..." : "Buat kelas"}
              </button>
            </form>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                  Daftar kelas
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {classrooms.length} kelas yang kamu kelola.
                </p>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={() => void loadClasses()}
                className={buttonClass("secondary", "px-4 py-2")}
              >
                {loading ? "Memuat..." : "Muat ulang"}
              </button>
            </div>

            {loading ? (
              <div
                role="status"
                className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500"
              >
                Memuat daftar kelas...
              </div>
            ) : classrooms.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
                <h3 className="font-semibold text-slate-900">
                  Belum ada kelas
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Buat kelas pertama untuk mendaftarkan siswa dan membuat ujian
                  khusus kelas.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {classrooms.map((classroom) => (
                  <article
                    key={classroom.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                          Kelas #{classroom.id}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-slate-950">
                          {classroom.name}
                        </h3>
                      </div>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {classroom.student_count} siswa
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Jumlah ujian</p>
                        <p className="mt-1 text-xl font-semibold tabular-nums">
                          {classroom.exam_count}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">
                          Rata-rata nilai
                        </p>
                        <p className="mt-1 text-xl font-semibold tabular-nums">
                          {scoreLabel(classroom.average_score)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 px-3 py-2.5">
                      <div>
                        <p className="text-xs text-slate-500">
                          Kode undangan
                        </p>
                        <p className="font-mono text-sm font-semibold tracking-wider text-slate-900">
                          {classroom.invite_code}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          void copyInviteCode(classroom.invite_code)
                        }
                        className={buttonClass(
                          "secondary",
                          "min-h-9 px-3 py-1.5 text-xs",
                        )}
                      >
                        Salin
                      </button>
                    </div>

                    <Link
                      href={`/teacher/classes/${classroom.id}`}
                      className={buttonClass(
                        "primary",
                        "mt-4 w-full px-4 py-2.5",
                      )}
                    >
                      Buka kelas <span aria-hidden="true">→</span>
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </section>

          <PageFooter role="teacher" />
        </div>
      </main>
    </RoleGuard>
  );
}
