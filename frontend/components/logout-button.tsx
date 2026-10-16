
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "../lib/api";
import { buttonClass } from "./ui/button";

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
        className={buttonClass("onDark", "active:scale-[0.98]")}
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
          className="mt-2 max-w-48 text-xs leading-5 text-red-100"
        >
          {error}
        </p>
      )}
    </div>
  );
}
