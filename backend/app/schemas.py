
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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
    label: str
    description: str
    weight: float
    max_score: int


class ExamCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    question: str = Field(min_length=1)
    criteria: list[CriterionCreate] = Field(min_length=1)


class ExamUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    question: str | None = Field(default=None, min_length=1)


class ExamResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    question: str
    created_at: datetime | None
    criteria: list[CriterionResponse]

class SubmissionCreate(BaseModel):
    student_answer: str = Field(min_length=1)


class GradedCriterionResponse(BaseModel):
    criterion_id: int
    label: str
    score: float
    reasoning: str
    satisfied: bool
    weight: float
    included_in_final_score: bool


class GradingResponse(BaseModel):
    submission_id: int
    exam_id: int
    final_score: float
    created_at: datetime | None
    criterion_results: list[GradedCriterionResponse]