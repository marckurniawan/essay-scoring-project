import AppHeader from "@/components/AppHeader";
import PageFooter from "@/components/PageFooter";
import PageHeader from "@/components/PageHeader";
import StudentSubmissionSummary from "@/components/student-submission-summary";
import RoleGuard from "@/components/role-guard";

export default function StudentHistoryPage() {
  return (
    <RoleGuard requiredRole="student">
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <AppHeader page="student" />
        <div className="mx-auto max-w-7xl space-y-6 px-5 py-7 sm:px-8 lg:py-9">
          <PageHeader
            role="student"
            title="Nilai & ringkasan"
            description="Lihat ringkasan performa dan buka total pengerjaan untuk memeriksa seluruh ujian beserta jawaban dan feedback-nya."
            backHref="/student/exams"
            backLabel="← Kembali ke daftar ujian"
          />
          <StudentSubmissionSummary />
          <PageFooter role="student" />
        </div>
      </main>
    </RoleGuard>
  );
}
