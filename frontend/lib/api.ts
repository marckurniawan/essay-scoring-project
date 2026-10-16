const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:8000")
).replace(/\/+$/, "");

export type Criterion = {
  id: number;
  exam_id: number;
  question_id?: number | null;
  label: string;
  description: string;
  weight: number;
  max_score: number;
};

export type ExamQuestion = {
  id: number;
  exam_id: number;
  question: string;
  weight: number;
  position: number;
  created_at: string | null;
  criteria: Criterion[];
};

export type Exam = {
  id: number;
  title: string;
  /** Legacy field mirrors the first question for compatibility. */
  question: string;
  duration_minutes: number;
  created_at: string | null;
  class_id?: number | null;
  class_ids?: number[];
  /** Legacy flattened list; new clients should use questions[].criteria. */
  criteria: Criterion[];
  questions: ExamQuestion[];
};

export type CriterionInput = {
  label: string;
  description: string;
  weight: number;
  max_score: number;
};

export type ExamQuestionInput = {
  question: string;
  weight: number;
  criteria: CriterionInput[];
};

export type ExamCreateInput = {
  title: string;
  duration_minutes: number;
  class_id?: number | null;
  questions: ExamQuestionInput[];
};

export type ExamQuestionUpdateInput = {
  question?: string;
  weight?: number;
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

export type GradedQuestionResult = {
  question_id: number;
  question_submission_id: number;
  question: string;
  weight: number;
  question_score: number | null;
  student_answer: string;
  criterion_results: CriterionGrade[];
};

export type GradingResult = {
  submission_id: number;
  exam_id: number;
  final_score: number;
  created_at: string | null;
  criterion_results: CriterionGrade[];
  question_results?: GradedQuestionResult[];
};

export type QuestionAnswerInput = {
  question_id: number;
  student_answer: string;
};

export type AuthenticatedUser = {
  id: number;
  name: string;
  email: string;
  role: "teacher" | "student";
  created_at: string | null;
};

export type SchoolClass = {
  id: number;
  name: string;
  invite_code: string;
  teacher_id: number;
  created_at: string | null;
  student_count: number;
  exam_count: number;
  average_score: number | null;
};

export type SchoolClassStudent = {
  id: number;
  name: string;
  email: string;
  completed_exams: number;
  average_score: number | null;
};

export type SchoolClassExam = {
  id: number;
  title: string;
  duration_minutes: number;
  created_at: string | null;
  completed_students: number;
  average_score: number | null;
};

export type SchoolClassDetail = SchoolClass & {
  students: SchoolClassStudent[];
  exams: SchoolClassExam[];
};

export type StudentPerformance = {
  student: {
    id: number;
    name: string;
    email: string;
    created_at: string | null;
  };
  class_id: number;
  class_name: string;
  average_score: number | null;
  completed_exams: number;
  total_attempts: number;
  attempts: SubmissionHistoryItem[];
};

export function listClasses(): Promise<SchoolClass[]> {
  return request<SchoolClass[]>("/api/classes");
}

export function createClass(name: string): Promise<SchoolClass> {
  return request<SchoolClass>("/api/classes", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function getClassDetail(classId: number): Promise<SchoolClassDetail> {
  return request<SchoolClassDetail>(`/api/classes/${classId}`);
}

export function getStudentPerformance(
  classId: number,
  studentId: number,
): Promise<StudentPerformance> {
  return request<StudentPerformance>(
    `/api/classes/${classId}/students/${studentId}`,
  );
}

export type LoginInput = {
  email: string;
  password: string;
};

export type StudentSignupInput = {
  name: string;
  email: string;
  password: string;
  class_code: string;
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
    credentials: "include",
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
      ? detail
          .map((item) => item.msg ?? "Invalid request")
          .join(", ")
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

export function createExam(
  payload: ExamCreateInput,
): Promise<Exam> {
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

export function updateExamQuestion(
  examId: number,
  questionId: number,
  payload: ExamQuestionUpdateInput,
): Promise<ExamQuestion> {
  return request<ExamQuestion>(
    `/api/exams/${examId}/questions/${questionId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
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

export function submitExam(
  examId: number,
  answers: QuestionAnswerInput[],
): Promise<GradingResult> {
  return request<GradingResult>(
    `/api/exams/${examId}/submissions`,
    {
      method: "POST",
      body: JSON.stringify({ answers }),
    },
  );
}

export function login(
  payload: LoginInput,
): Promise<AuthenticatedUser> {
  return request<AuthenticatedUser>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function registerStudent(
  payload: StudentSignupInput,
): Promise<AuthenticatedUser> {
  return request<AuthenticatedUser>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCurrentUser(): Promise<AuthenticatedUser> {
  return request<AuthenticatedUser>("/api/auth/me");
}

export function logout(): Promise<void> {
  return request<void>("/api/auth/logout", {
    method: "POST",
  });
}


export type ScoreProtest = {
  id: number;
  submission_id: number;
  student_id: number;
  criterion_id: number | null;
  reason: string;
  status: "pending" | "accepted" | "rejected";
  original_score: number | null;
  reviewed_score: number | null;
  teacher_feedback: string | null;
  reviewed_by: number | null;
  created_at: string | null;
  reviewed_at: string | null;
  student_name?: string | null;
  student_email?: string | null;
  exam_id?: number | null;
  exam_title?: string | null;
  class_id?: number | null;
  class_name?: string | null;
};

export type ScoreProtestCreateInput = {
  reason: string;
  criterion_id?: number | null;
};

export function createScoreProtest(
  submissionId: number,
  payload: ScoreProtestCreateInput,
): Promise<ScoreProtest> {
  return request<ScoreProtest>(
    `/api/submissions/${submissionId}/protests`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}



export type SubmissionHistoryCriterion = {
  criterion_id: number | null;
  criterion_label: string | null;
  score: number | null;
  reasoning: string | null;
  satisfied: boolean | null;
  weight: number | null;
  included: boolean | null;
  weighted_score: number | null;
};

export type SubmissionHistoryQuestion = {
  question_submission_id: number;
  question_id: number;
  question: string;
  weight: number;
  student_answer: string;
  question_score: number | null;
  criterion_results: SubmissionHistoryCriterion[];
};

export type SubmissionHistoryItem = {
  id: number;
  exam_id: number;
  exam_title: string | null;
  duration_minutes?: number | null;
  student_answer: string;
  final_score: number | null;
  created_at: string;
  started_at?: string | null;
  deadline_at?: string | null;
  submitted_at?: string | null;
  status?: "in_progress" | "graded" | "expired" | string;
  criterion_results: SubmissionHistoryCriterion[];
  question_results?: SubmissionHistoryQuestion[];
  score_protest?: ScoreProtest | null;
};


export function getMySubmissions(): Promise<SubmissionHistoryItem[]> {
  return request<SubmissionHistoryItem[]>("/api/submissions/me");
}


export type ScoreProtestReviewInput =
  | {
      status: "accepted";
      teacher_feedback: string;
      reviewed_score: number;
    }
  | {
      status: "rejected";
      teacher_feedback: string;
      reviewed_score?: null;
    };

export function getScoreProtests(): Promise<ScoreProtest[]> {
  return request<ScoreProtest[]>("/api/protests");
}

export function reviewScoreProtest(
  protestId: number,
  payload: ScoreProtestReviewInput,
): Promise<ScoreProtest> {
  return request<ScoreProtest>(
    `/api/protests/${protestId}/review`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export type QuestionAttempt = {
  question_submission_id: number;
  question_id: number;
  question: string;
  weight: number;
  student_answer: string;
  question_score: number | null;
};

export type SubmissionAttempt = {
  id: number;
  exam_id: number;
  /** Legacy aggregate answer kept by the backend for compatibility. */
  student_answer: string;
  started_at: string;
  deadline_at: string;
  status: "in_progress" | "graded" | "expired";
  questions?: QuestionAttempt[];
};

export async function startExamAttempt(
  examId: number,
): Promise<SubmissionAttempt> {
  return request<SubmissionAttempt>(
    `/api/exams/${examId}/attempts`,
    {
      method: "POST",
    },
  );
}

export async function getMyExamAttempt(
  examId: number,
): Promise<SubmissionAttempt> {
  return request<SubmissionAttempt>(
    `/api/exams/${examId}/attempts/me`,
  );
}

export async function saveSubmissionDraft(
  examId: number,
  submissionId: number,
  studentAnswer: string,
): Promise<SubmissionAttempt> {
  return request<SubmissionAttempt>(
    `/api/exams/${examId}/submissions/${submissionId}/draft`,
    {
      method: "PATCH",
      body: JSON.stringify({
        student_answer: studentAnswer,
      }),
    },
  );
}

export async function saveQuestionDraft(
  examId: number,
  submissionId: number,
  questionId: number,
  studentAnswer: string,
): Promise<SubmissionAttempt> {
  return request<SubmissionAttempt>(
    `/api/exams/${examId}/submissions/${submissionId}/questions/${questionId}/draft`,
    {
      method: "PATCH",
      body: JSON.stringify({ student_answer: studentAnswer }),
    },
  );
}
