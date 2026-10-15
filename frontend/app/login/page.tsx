
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { login } from "@/lib/api";

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
          : "Login gagal. Periksa koneksi dan coba kembali.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10 text-slate-900">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <p className="text-sm font-semibold tracking-wide text-blue-700">
            ESSAY SCORING
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Welcome back
          </h1>

          <p className="mt-2 leading-6 text-slate-600">
            Login untuk mengelola penilaian essay atau melihat hasil
            ujian dan feedback kamu.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800"
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
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-semibold"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              placeholder="Masukkan password"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Memverifikasi..." : "Login"}
          </button>

          <p className="text-xs leading-5 text-slate-500">
            Akses yang tersedia ditentukan oleh role akun kamu.
          </p>
        </form>
      </div>
    </main>
  );
}
