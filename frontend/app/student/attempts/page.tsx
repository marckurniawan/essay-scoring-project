import AppHeader from "@/components/AppHeader";
import PageFooter from "@/components/PageFooter";
import PageHeader from "@/components/PageHeader";
import StudentSubmissionAttempts from "@/components/student-submission-attempts";
import RoleGuard from "@/components/role-guard";

export default function StudentAttemptsPage() {
  return (
    <RoleGuard requiredRole="student">
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <AppHeader page="student" />
        <div className="mx-auto max-w-7xl space-y-6 px-5 py-7 sm:px-8 lg:py-9">
          <PageHeader
            role="student"
            title="Total pengerjaan"
            description="Seluruh ujian yang kamu kerjakan, nilai akhirnya, jawaban yang terekam, detail skor per soal, dan feedback kriteria."
            backHref="/student/history"
            backLabel="← Ringkasan nilai"
          />
          <StudentSubmissionAttempts />
          <PageFooter role="student" />
        </div>
      </main>
    </RoleGuard>
  );
}
