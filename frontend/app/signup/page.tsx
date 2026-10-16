"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Logo from "@/components/Logo";
import Underline from "@/components/Underline";
import Badge from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/button";
import { registerStudent } from "@/lib/api";

function explainError(message: string): string {
  if (message.includes("12 characters") || message.includes("at least 12")) {
    return "Kata sandi harus memiliki minimal 12 karakter.";
  }
  return message;
}

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [classCode, setClassCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 12) {
      setError("Kata sandi harus memiliki minimal 12 karakter.");
      return;
    }
    if (password !== passwordConfirmation) {
      setError("Konfirmasi kata sandi tidak sama.");
      return;
    }

    setSubmitting(true);
    try {
      await registerStudent({
        name: name.trim(),
        email: email.trim(),
        password,
        class_code: classCode.trim().toUpperCase(),
      });
      router.replace("/student");
      router.refresh();
    } catch (err) {
      setError(
        explainError(
          err instanceof Error
            ? err.message
            : "Pendaftaran gagal. Periksa koneksi dan coba kembali.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-white text-slate-900">
      <section
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-10 text-white lg:flex"
        style={{ background: "linear-gradient(135deg, #bae6fd 0%, #0e7490 45%, #042f2e 100%)" }}
      >
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-orange-400/30 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-emerald-900/40 blur-3xl" />
        <Logo size={110} />
        <div className="relative">
          <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-200">
            Penilaian Berbantuan AI
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight">
            Mulai Belajar
            <br />
            <span className="relative inline-block">
              dengan Lebih Terarah
              <Underline className="absolute -bottom-1 left-0 text-amber-300" />
            </span>
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-6 text-sky-100">
            Bergabung ke kelas, kerjakan ujian esai, dan pelajari umpan balik dari hasil penilaianmu.
          </p>
        </div>
        <p className="relative text-xs text-teal-200">© 2026 EssAI</p>
      </section>

      <section className="flex w-full items-center justify-center px-5 py-10 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo size={96} /></div>
          <div className="mb-8">
            <Badge>Pendaftaran siswa</Badge>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Buat akun siswa</h2>
            <p className="mt-2 leading-6 text-slate-600">
              Gunakan kode kelas dari guru untuk membuat akun dan bergabung ke kelas yang tepat.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-semibold">Nama lengkap</label>
              <input id="name" type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={120} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100" placeholder="Masukkan nama lengkap" />
            </div>
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold">Email</label>
              <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={320} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100" placeholder="nama@contoh.com" />
            </div>
            <div>
              <label htmlFor="class-code" className="mb-2 block text-sm font-semibold">Kode kelas</label>
              <input id="class-code" type="text" autoComplete="off" value={classCode} onChange={(event) => setClassCode(event.target.value.toUpperCase())} required minLength={8} maxLength={8} pattern="[A-HJ-NP-Z2-9]{8}" className="w-full rounded-xl border border-slate-300 px-4 py-3 uppercase outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100" placeholder="Contoh: A7BC2DEF" aria-describedby="class-code-help" />
              <p id="class-code-help" className="mt-1.5 text-xs leading-5 text-slate-500">Minta kode ini kepada guru yang mengelola kelas.</p>
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold">Kata sandi</label>
              <input id="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} maxLength={1024} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100" placeholder="Minimal 12 karakter" />
            </div>
            <div>
              <label htmlFor="password-confirmation" className="mb-2 block text-sm font-semibold">Ulangi kata sandi</label>
              <input id="password-confirmation" type="password" autoComplete="new-password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} required minLength={12} maxLength={1024} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100" placeholder="Masukkan kata sandi sekali lagi" />
            </div>
            <button type="submit" disabled={submitting} className={buttonClass("primary", "w-full py-3")}>
              {submitting ? "Membuat akun..." : "Daftar sebagai siswa"}
            </button>
            <p className="text-center text-sm text-slate-600">
              Sudah punya akun?{" "}
              <Link href="/login" className="font-semibold text-sky-700 underline-offset-4 hover:underline">Masuk di sini</Link>
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
