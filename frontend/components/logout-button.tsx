
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "../lib/api";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    setLoading(true);
    setError("");

    try {
      await logout();
      router.replace("/login");
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Logout gagal."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shrink-0">
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        aria-label={loading ? "Sedang keluar" : "Logout"}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
        >
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
          <path d="M12 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
        </svg>

        <span>{loading ? "Keluar..." : "Logout"}</span>
      </button>

      {error && (
        <p
          role="alert"
          className="mt-2 max-w-48 text-xs leading-5 text-red-600"
        >
          {error}
        </p>
      )}
    </div>
  );
}
