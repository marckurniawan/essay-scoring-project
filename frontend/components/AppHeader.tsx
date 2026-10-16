
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "./Logo";
import LogoutButton from "./logout-button";
import { getCurrentUser, type AuthenticatedUser } from "../lib/api";

type AppHeaderProps = {
  page: "teacher" | "student";
};

const NAV_LINKS: Record<
  AppHeaderProps["page"],
  { href: string; label: string }[]
> = {
  student: [
    { href: "/student", label: "Beranda" },
    { href: "/student/exams", label: "Daftar ujian" },
    { href: "/student/history", label: "Ringkasan" },
    { href: "/student/attempts", label: "Total pengerjaan" },
  ],
  teacher: [
    { href: "/teacher", label: "Beranda" },
    { href: "/teacher/exams", label: "Kelola ujian" },
    { href: "/teacher/protests", label: "Review protes" },
  ],
};

const ROLE_LABEL: Record<AppHeaderProps["page"], string> = {
  teacher: "Guru",
  student: "Siswa",
};

export default function AppHeader({ page }: AppHeaderProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then((current) => {
        if (!cancelled) setUser(current);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header
      className="sticky top-0 z-10 text-white"
      style={{
        background:
          "linear-gradient(135deg, #bae6fd 0%, #0e7490 45%, #042f2e 100%)",
      }}
    >
      <div className="flex items-center justify-between gap-4 px-4 py-2 sm:px-6">
        <Link
          href={page === "teacher" ? "/teacher" : "/student"}
          className="flex items-center"
        >
          <Logo size={84} />
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-white">
              {user?.name ?? "..."}
            </p>
            <span className="inline-block rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white">
              {ROLE_LABEL[page]}
            </span>
          </div>

          <LogoutButton />
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-1 border-t border-white/15 px-4 py-2 sm:px-6">
        {NAV_LINKS[page].map((link) => {
          const active =
            link.href === pathname ||
            (link.href !== `/${page}` && pathname?.startsWith(link.href));

          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                active
                  ? "rounded-full bg-white/25 px-3.5 py-2 text-sm font-semibold text-white"
                  : "rounded-full px-3.5 py-2 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white"
              }
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
