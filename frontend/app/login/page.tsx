
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { login } from "@/lib/api";
import Logo from "@/components/Logo";
import Underline from "@/components/Underline";
import Badge from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      const user = await login({
        email: email.trim(),
        password,
      });

      router.replace(
        user.role === "teacher" ? "/teacher" : "/student",
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal masuk. Periksa koneksi lalu coba kembali.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-white text-slate-900">
      <section
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-10 text-white lg:flex"
        style={{
          background:
            "linear-gradient(135deg, #bae6fd 0%, #0e7490 45%, #042f2e 100%)",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-orange-400/30 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-emerald-900/40 blur-3xl"
        />

        <Logo size={110} />

        <div className="relative">
          <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-200">
            Penilaian Berbantuan AI
          </span>

          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight">
            Lebih Sedikit Mengoreksi
            <br />
            <span className="relative inline-block">
              Lebih Banyak Mengajar
              <Underline className="absolute -bottom-1 left-0 text-amber-300" />
            </span>
          </h1>

          <p className="mt-5 max-w-sm text-sm leading-6 text-sky-100">
            Guru menyusun ujian dan rubrik. Siswa mengerjakan, lalu AI membantu
            memberikan nilai dan umpan balik sesuai kriteria.
          </p>
        </div>

        <p className="relative text-xs text-teal-200">
          © 2026 EssAI
        </p>
      </section>

      <section className="flex w-full items-center justify-center px-5 py-10 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo size={96} />
          </div>

          <div className="mb-8">
            <Badge>Selamat datang</Badge>

            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
              Masuk ke akunmu
            </h2>

            <p className="mt-2 leading-6 text-slate-600">
              Kelola penilaian esai atau lihat hasil ujian dan umpan balikmu.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800"
              >
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                maxLength={320}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                placeholder="nama@contoh.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold"
              >
                Kata sandi
              </label>

              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                placeholder="Masukkan kata sandi"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={buttonClass("primary", "w-full py-3")}
            >
              {submitting ? "Memeriksa akun..." : "Masuk"}
            </button>

            <p className="text-center text-sm text-slate-600">
              Belum punya akun?{" "}
              <Link href="/signup" className="font-semibold text-sky-700 underline-offset-4 hover:underline">
                Daftar sebagai siswa
              </Link>
            </p>
            <p className="text-xs leading-5 text-slate-500">
              Hak akses ditentukan otomatis berdasarkan akunmu.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
