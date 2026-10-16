
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_serializer
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.datetime_utils import to_utc_iso
from app.models import Criterion, Exam, ScoreProtest, Submission, User
from app.security import require_role


router = APIRouter(prefix="/api", tags=["score protests"])


class ScoreProtestCreate(BaseModel):
    reason: str = Field(min_length=10, max_length=3000)
    criterion_id: int | None = None


class ScoreProtestReview(BaseModel):
    status: str = Field(pattern="^(accepted|rejected)$")
    teacher_feedback: str = Field(min_length=5, max_length=3000)
    reviewed_score: float | None = Field(default=None, ge=0, le=100)


class ScoreProtestResponse(BaseModel):
    id: int
    submission_id: int
    student_id: int
    criterion_id: int | None
    reason: str
    status: str
    original_score: float | None
    reviewed_score: float | None
    teacher_feedback: str | None
    reviewed_by: int | None
    created_at: datetime | None
    reviewed_at: datetime | None

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("created_at", "reviewed_at")
    def serialize_datetime(self, value: datetime | None) -> str | None:
        return to_utc_iso(value)


@router.post(
    "/submissions/{submission_id}/protests",
    response_model=ScoreProtestResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_score_protest(
    submission_id: int,
    payload: ScoreProtestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student")),
):


    reason = payload.reason.strip()

    if len(reason) < 10:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Reason must contain at least 10 non-whitespace characters.",
        )

    submission = (
        db.query(Submission)
        .filter(
            Submission.id == submission_id,
            Submission.student_id == current_user.id,
        )
        .first()
    )

    if submission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found.",
        )

    if submission.final_score is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This submission has not been graded yet.",
        )

    if payload.criterion_id is not None:
        criterion = (
            db.query(Criterion)
            .filter(
                Criterion.id == payload.criterion_id,
                Criterion.exam_id == submission.exam_id,
            )
            .first()
        )

        if criterion is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Criterion does not belong to this exam.",
            )

    existing_protest = (
        db.query(ScoreProtest)
        .filter(ScoreProtest.submission_id == submission.id)
        .first()
    )

    if existing_protest is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A protest already exists for this submission.",
        )

    protest = ScoreProtest(
        submission_id=submission.id,
        student_id=current_user.id,
        criterion_id=payload.criterion_id,
        reason=reason,
        status="pending",
        original_score=submission.final_score,
    )

    db.add(protest)

    try:
        db.commit()
        db.refresh(protest)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A protest already exists for this submission.",
        )

    return protest


@router.get(
    "/protests",
    response_model=list[ScoreProtestResponse],
)
def list_score_protests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher")),
):
    return (
        db.query(ScoreProtest)
        .order_by(ScoreProtest.created_at.desc())
        .all()
    )


@router.patch(
    "/protests/{protest_id}/review",
    response_model=ScoreProtestResponse,
)
def review_score_protest(
    protest_id: int,
    payload: ScoreProtestReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher")),
):
    protest = (
        db.query(ScoreProtest)
        .filter(ScoreProtest.id == protest_id)
        .with_for_update()
        .first()
    )

    if protest is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Protest not found.",
        )

    if protest.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This protest has already been reviewed.",
        )

    feedback = payload.teacher_feedback.strip()

    if len(feedback) < 5:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Feedback must contain at least 5 non-whitespace characters.",
        )

    if payload.status == "accepted":
        if payload.reviewed_score is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A reviewed score is required when accepting a protest.",
            )

        submission = (
            db.query(Submission)
            .filter(Submission.id == protest.submission_id)
            .first()
        )

        if submission is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Submission not found.",
            )

        if payload.reviewed_score > 100:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Reviewed score cannot exceed 100.",
            )

        protest.reviewed_score = payload.reviewed_score
    else:
        if payload.reviewed_score is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A reviewed score must not be provided for a rejected protest.",
            )

        protest.reviewed_score = None

    protest.status = payload.status
    protest.teacher_feedback = feedback
    protest.reviewed_by = current_user.id
    protest.reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(protest)

    return protest
