from datetime import datetime, timezone
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_serializer,
    model_validator,
)


class CriterionCreate(BaseModel):
    label: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    weight: float = Field(default=0, ge=0)
    max_score: int = Field(default=100, gt=0)


class CriterionUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1)
    weight: float | None = Field(default=None, ge=0)
    max_score: int | None = Field(default=None, gt=0)


class CriterionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    exam_id: int
    question_id: int | None = None
    label: str
    description: str
    weight: float
    max_score: int


class ExamQuestionCreate(BaseModel):
    question: str = Field(min_length=1)
    weight: float = Field(default=100, ge=0)
    criteria: list[CriterionCreate] = Field(min_length=1)


class ExamQuestionUpdate(BaseModel):
    question: str | None = Field(default=None, min_length=1)
    weight: float | None = Field(default=None, ge=0)


class ExamQuestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    exam_id: int
    question: str
    weight: float
    position: int
    created_at: datetime | None
    criteria: list[CriterionResponse]


class ExamCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    duration_minutes: int = Field(default=30, ge=1, le=240)
    questions: list[ExamQuestionCreate] | None = None

    # Legacy format: retained for older frontend requests and tests.
    question: str | None = Field(default=None, min_length=1)
    criteria: list[CriterionCreate] | None = None

    @model_validator(mode="after")
    def validate_question_payload(self):
        has_new_format = self.questions is not None
        has_legacy_format = self.question is not None and self.criteria is not None

        if has_new_format == has_legacy_format:
            raise ValueError(
                "Provide either 'questions' or both legacy fields 'question' and 'criteria'."
            )

        question_definitions = (
            self.questions
            if has_new_format
            else [ExamQuestionCreate(
                question=self.question,
                weight=100,
                criteria=self.criteria,
            )]
        )
        if not question_definitions:
            raise ValueError("An exam must contain at least one question.")
        if sum(item.weight for item in question_definitions) <= 0:
            raise ValueError("At least one question must have a positive weight.")

        for item in question_definitions:
            if item.weight > 0 and not any(c.weight > 0 for c in item.criteria):
                raise ValueError(
                    "Every question with a positive question weight must have at least one criterion with a positive weight."
                )

        return self


class ExamUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    question: str | None = Field(default=None, min_length=1)
    duration_minutes: int | None = Field(default=None, ge=1, le=240)


class ExamResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    question: str
    duration_minutes: int
    created_at: datetime | None
    criteria: list[CriterionResponse]
    questions: list[ExamQuestionResponse]


class QuestionAnswerInput(BaseModel):
    question_id: int
    student_answer: str = Field(max_length=50000)


class SubmissionCreate(BaseModel):
    # Legacy field is supported only for one-question exams.
    student_answer: str | None = Field(default=None, max_length=50000)
    # Multi-question clients submit one answer per question.
    answers: list[QuestionAnswerInput] | None = None

    @model_validator(mode="after")
    def validate_submission_payload(self):
        if (self.student_answer is None) == (self.answers is None):
            raise ValueError("Provide either 'student_answer' or 'answers'.")
        if self.answers is not None:
            if not self.answers:
                raise ValueError("At least one question answer must be provided.")
            question_ids = [item.question_id for item in self.answers]
            if len(question_ids) != len(set(question_ids)):
                raise ValueError("Duplicate question IDs are not allowed.")
        return self


class SubmissionDraftUpdate(BaseModel):
    student_answer: str = Field(max_length=50000)


class QuestionAttemptResponse(BaseModel):
    question_submission_id: int
    question_id: int
    question: str
    weight: float
    student_answer: str
    question_score: float | None = None


class SubmissionAttemptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    exam_id: int
    student_answer: str
    started_at: datetime
    deadline_at: datetime
    status: str
    questions: list[QuestionAttemptResponse] = Field(default_factory=list)

    @field_serializer("started_at", "deadline_at")
    def serialize_utc_datetime(self, value: datetime) -> str:
        if value.tzinfo is None:
            return f"{value.isoformat()}Z"
        return (
            value.astimezone(timezone.utc)
            .isoformat()
            .replace("+00:00", "Z")
        )


class GradedCriterionResponse(BaseModel):
    criterion_id: int
    label: str
    score: float
    reasoning: str
    satisfied: bool
    weight: float
    included_in_final_score: bool


class GradedQuestionResponse(BaseModel):
    question_id: int
    question_submission_id: int
    question: str
    weight: float
    question_score: float | None
    student_answer: str
    criterion_results: list[GradedCriterionResponse]


class GradingResponse(BaseModel):
    submission_id: int
    exam_id: int
    final_score: float
    created_at: datetime | None
    # Flat result list is retained for the existing UI/history API.
    criterion_results: list[GradedCriterionResponse]
    question_results: list[GradedQuestionResponse] = Field(default_factory=list)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=1024)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: Literal["teacher", "student"]
    created_at: datetime | None
