import Link from "next/link";
import Badge from "./ui/Badge";
import { buttonClass } from "./ui/button";

type Role = "teacher" | "student";

type PageHeaderProps = {
  role: Role;
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
};

const ROLE_BADGE: Record<Role, string> = {
  teacher: "Ruang Guru",
  student: "Ruang Siswa",
};

export default function PageHeader({
  role,
  title,
  description,
  backHref,
  backLabel,
}: PageHeaderProps) {
  return (
    <section className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
      <div>
        <Badge>{ROLE_BADGE[role]}</Badge>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          {description}
        </p>
      </div>

      {backHref && (
        <Link
          href={backHref}
          className={buttonClass("secondary", "shrink-0")}
        >
          {backLabel ?? "← Beranda"}
        </Link>
      )}
    </section>
  );
}
