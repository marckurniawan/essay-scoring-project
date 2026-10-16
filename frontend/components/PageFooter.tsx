type Role = "teacher" | "student";

const ROLE_BADGE: Record<Role, string> = {
  teacher: "Ruang Guru",
  student: "Ruang Siswa",
};

export default function PageFooter({ role }: { role: Role }) {
  return (
    <footer className="border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
      EssAI · {ROLE_BADGE[role]} · Skor dihasilkan oleh AI dan dapat berbeda dari penilaian manual — ajukan protes nilai bila menurutmu kurang tepat.
    </footer>
  );
}
