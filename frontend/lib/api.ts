const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");

export type Criterion = {
  id: number;
  exam_id: number;
  label: string;
  description: string;
  weight: number;
  max_score: number;
};

export type Exam = {
  id: number;
  title: string;
  question: string;
  created_at: string | null;
  criteria: Criterion[];
};

export type CriterionInput = {
  label: string;
  description: string;
  weight: number;
  max_score: number;
};

export type ExamCreateInput = {
  title: string;
  question: string;
  criteria: CriterionInput[];
};

export type CriterionGrade = {
  criterion_id: number;
  label: string;
  score: number;
  reasoning: string;
  satisfied: boolean;
  weight: number;
  included_in_final_score: boolean;
};

export type GradingResult = {
  submission_id: number;
  exam_id: number;
  final_score: number;
  created_at: string | null;
  criterion_results: CriterionGrade[];
};

type ApiErrorBody = {
  detail?: string | { msg?: string }[];
};

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | ApiErrorBody
      | null;

    const detail = body?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg ?? "Invalid request").join(", ")
      : detail ?? `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function listExams(): Promise<Exam[]> {
  return request<Exam[]>("/api/exams");
}

export function createExam(payload: ExamCreateInput): Promise<Exam> {
  return request<Exam>("/api/exams", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCriterionWeight(
  examId: number,
  criterionId: number,
  weight: number,
): Promise<Criterion> {
  return request<Criterion>(
    `/api/exams/${examId}/criteria/${criterionId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ weight }),
    },
  );
}

export function gradeSubmission(
  examId: number,
  studentAnswer: string,
): Promise<GradingResult> {
  return request<GradingResult>(
    `/api/exams/${examId}/submissions`,
    {
      method: "POST",
      body: JSON.stringify({
        student_answer: studentAnswer,
      }),
    },
  );
}