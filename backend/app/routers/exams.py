
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Criterion, Exam
from app.schemas import (
    CriterionCreate,
    CriterionResponse,
    CriterionUpdate,
    ExamCreate,
    ExamResponse,
    ExamUpdate,
)

router = APIRouter(prefix="/api/exams", tags=["Exams"])


@router.post(
    "",
    response_model=ExamResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_exam(payload: ExamCreate, db: Session = Depends(get_db)):
    exam = Exam(
        title=payload.title,
        question=payload.question,
    )

    exam.criteria = [
        Criterion(
            label=item.label,
            description=item.description,
            weight=item.weight,
            max_score=item.max_score,
        )
        for item in payload.criteria
    ]

    db.add(exam)
    db.commit()
    db.refresh(exam)

    return exam


@router.get("", response_model=list[ExamResponse])
def list_exams(db: Session = Depends(get_db)):
    return db.query(Exam).order_by(Exam.id.desc()).all()


@router.get("/{exam_id}", response_model=ExamResponse)
def get_exam(exam_id: int, db: Session = Depends(get_db)):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()

    if exam is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found",
        )

    return exam


@router.patch("/{exam_id}", response_model=ExamResponse)
def update_exam(
    exam_id: int,
    payload: ExamUpdate,
    db: Session = Depends(get_db),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()

    if exam is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found",
        )

    updates = payload.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide at least one field to update",
        )

    if any(value is None for value in updates.values()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Fields cannot be null",
        )

    for field, value in updates.items():
        setattr(exam, field, value)

    db.commit()
    db.refresh(exam)

    return exam


@router.patch(
    "/{exam_id}/criteria/{criterion_id}",
    response_model=CriterionResponse,
)
def update_criterion(
    exam_id: int,
    criterion_id: int,
    payload: CriterionUpdate,
    db: Session = Depends(get_db),
):
    criterion = (
        db.query(Criterion)
        .filter(
            Criterion.id == criterion_id,
            Criterion.exam_id == exam_id,
        )
        .first()
    )

    if criterion is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Criterion not found for this exam",
        )

    updates = payload.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide at least one field to update",
        )

    if any(value is None for value in updates.values()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Fields cannot be null",
        )

    for field, value in updates.items():
        setattr(criterion, field, value)

    db.commit()
    db.refresh(criterion)

    return criterion


@router.delete("/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exam(exam_id: int, db: Session = Depends(get_db)):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()

    if exam is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found",
        )

    db.delete(exam)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
