
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from pydantic import BaseModel, ConfigDict, Field, field_serializer
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.class_access import ensure_exam_access_or_404
from app.database import get_db
from app.datetime_utils import to_utc_iso
from app.models import Criterion, Exam, SchoolClass, ScoreProtest, Submission, User
from app.security import require_role


router = APIRouter(prefix="/api", tags=["Protes nilai"])


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
    student_name: str | None = None
    student_email: str | None = None
    exam_id: int | None = None
    exam_title: str | None = None
    class_id: int | None = None
    class_name: str | None = None

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
            detail="Alasan harus berisi minimal 10 karakter yang bukan spasi.",
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
            detail="Pengerjaan tidak ditemukan.",
        )

    if submission.final_score is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Pengerjaan ini belum memiliki nilai akhir.",
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
                detail="Kriteria tersebut bukan bagian dari ujian ini.",
            )

    existing_protest = (
        db.query(ScoreProtest)
        .filter(ScoreProtest.submission_id == submission.id)
        .first()
    )

    if existing_protest is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Protes nilai untuk pengerjaan ini sudah diajukan.",
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
            detail="Protes nilai untuk pengerjaan ini sudah diajukan.",
        )

    return _protest_response(protest, current_user)


@router.get(
    "/protests",
    response_model=list[ScoreProtestResponse],
)
def list_score_protests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher")),
):
    protests = (
        db.query(ScoreProtest)
        .join(Submission, ScoreProtest.submission_id == Submission.id)
        .join(Exam, Submission.exam_id == Exam.id)
        .options(
            joinedload(ScoreProtest.student),
            joinedload(ScoreProtest.submission)
            .joinedload(Submission.exam)
            .selectinload(Exam.classrooms),
        )
        .filter(
            or_(
                ~Exam.classrooms.any(),
                Exam.classrooms.any(SchoolClass.teacher_id == current_user.id),
            )
        )
        .order_by(ScoreProtest.created_at.desc())
        .all()
    )
    return [_protest_response(protest, current_user) for protest in protests]


def _protest_response(protest: ScoreProtest, context_user: User) -> dict:
    exam_classrooms = protest.submission.exam.classrooms
    if context_user.role == "teacher":
        classroom = next(
            (
                assigned_class
                for assigned_class in exam_classrooms
                if assigned_class.teacher_id == context_user.id
            ),
            None,
        )
    else:
        student_classroom = protest.student.classroom if protest.student else None
        classroom = next(
            (
                assigned_class
                for assigned_class in exam_classrooms
                if student_classroom is not None
                and assigned_class.id == student_classroom.id
            ),
            None,
        )
    return {
        "id": protest.id,
        "submission_id": protest.submission_id,
        "student_id": protest.student_id,
        "criterion_id": protest.criterion_id,
        "reason": protest.reason,
        "status": protest.status,
        "original_score": protest.original_score,
        "reviewed_score": protest.reviewed_score,
        "teacher_feedback": protest.teacher_feedback,
        "reviewed_by": protest.reviewed_by,
        "created_at": protest.created_at,
        "reviewed_at": protest.reviewed_at,
        "student_name": protest.student.name if protest.student else None,
        "student_email": protest.student.email if protest.student else None,
        "exam_id": protest.submission.exam_id if protest.submission else None,
        "exam_title": (
            protest.submission.exam.title
            if protest.submission and protest.submission.exam
            else None
        ),
        "class_id": classroom.id if classroom else None,
        "class_name": classroom.name if classroom else "Belum dikaitkan ke kelas",
    }


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
        .with_for_update(of=ScoreProtest)
        .first()
    )

    if protest is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Protes nilai tidak ditemukan.",
        )

    ensure_exam_access_or_404(db, current_user, protest.submission.exam)

    if protest.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Protes nilai ini sudah ditinjau.",
        )

    feedback = payload.teacher_feedback.strip()

    if len(feedback) < 5:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Umpan balik harus berisi minimal 5 karakter yang bukan spasi.",
        )

    if payload.status == "accepted":
        if payload.reviewed_score is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Nilai hasil tinjauan wajib diisi saat protes diterima.",
            )

        submission = (
            db.query(Submission)
            .filter(Submission.id == protest.submission_id)
            .first()
        )

        if submission is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pengerjaan tidak ditemukan.",
            )

        if payload.reviewed_score > 100:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Nilai hasil tinjauan tidak boleh melebihi 100.",
            )

        protest.reviewed_score = payload.reviewed_score
    else:
        if payload.reviewed_score is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Nilai hasil tinjauan tidak boleh diisi saat protes ditolak.",
            )

        protest.reviewed_score = None

    protest.status = payload.status
    protest.teacher_feedback = feedback
    protest.reviewed_by = current_user.id
    protest.reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(protest)

    return _protest_response(protest, current_user)
