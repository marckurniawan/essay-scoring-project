
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "../lib/api";

type RoleGuardProps = {
  requiredRole: "teacher" | "student";
  children: ReactNode;
};

export default function RoleGuard({
  requiredRole,
  children,
}: RoleGuardProps) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const user = await getCurrentUser();

        if (cancelled) return;

        if (user.role !== requiredRole) {
          router.replace(
            user.role === "teacher" ? "/teacher" : "/student"
          );
          return;
        }

        setAuthorized(true);
      } catch {
        if (!cancelled) {
          router.replace("/login");
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [requiredRole, router]);

  if (checking || !authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">
          Memeriksa sesi pengguna...
        </p>
      </main>
    );
  }

  return <>{children}</>;
}
