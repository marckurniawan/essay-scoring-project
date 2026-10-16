import AppHeader from "@/components/AppHeader";
import PageFooter from "@/components/PageFooter";
import PageHeader from "@/components/PageHeader";
import RoleGuard from "@/components/role-guard";
import TeacherScoreProtests from "@/components/teacher-score-protests";

export default function TeacherProtestsPage() {
  return (
    <RoleGuard requiredRole="teacher">
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <AppHeader page="teacher" />

        <div className="mx-auto max-w-7xl space-y-6 px-5 py-7 sm:px-8 lg:py-9">
          <PageHeader
            role="teacher"
            title="Protes nilai"
            description="Tinjau protes nilai dari siswa, periksa alasannya, dan putuskan untuk menerima atau menolak tiap permintaan."
            backHref="/teacher"
          />

          <TeacherScoreProtests />

          <PageFooter role="teacher" />
        </div>
      </main>
    </RoleGuard>
  );
}
