from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session, selectinload

from app.class_access import can_access_exam, ensure_exam_access_or_404
from app.database import get_db
from app.models import Criterion, Exam, ExamQuestion, SchoolClass, User
from app.schemas import (
    CriterionResponse,
    CriterionUpdate,
    ExamCreate,
    ExamQuestionResponse,
    ExamQuestionUpdate,
    ExamResponse,
    ExamUpdate,
)
from app.security import get_current_user, require_role


router = APIRouter(prefix="/api/exams", tags=["Exams"])


def _create_question(
    db: Session,
    exam: Exam,
    question_text: str,
    question_weight: float,
    position: int,
    criterion_items,
) -> ExamQuestion:
    question = ExamQuestion(
        exam_id=exam.id,
        question=question_text,
        weight=question_weight,
        position=position,
    )
    db.add(question)
    db.flush()

    for item in criterion_items:
        db.add(
            Criterion(
                exam_id=exam.id,
                question_id=question.id,
                label=item.label,
                description=item.description,
                weight=item.weight,
                max_score=item.max_score,
            )
        )

    return question


@router.post(
    "",
    response_model=ExamResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_exam(
    payload: ExamCreate,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    classroom = None
    if payload.class_id is not None:
        classroom = (
            db.query(SchoolClass)
            .filter(
                SchoolClass.id == payload.class_id,
                SchoolClass.teacher_id == teacher.id,
            )
            .first()
        )
        if classroom is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Kelas tidak ditemukan atau bukan milik akun guru ini.",
            )

    if payload.questions is not None:
        question_definitions = [
            (item.question, item.weight, item.criteria)
            for item in payload.questions
        ]
    else:
        # Legacy clients still create one question and top-level criteria.
        question_definitions = [(payload.question, 100, payload.criteria)]

    first_question_text = question_definitions[0][0]
    exam = Exam(
        title=payload.title,
        question=first_question_text,
        duration_minutes=payload.duration_minutes,
    )
    db.add(exam)
    db.flush()
    if classroom is not None:
        exam.classrooms.append(classroom)

    for position, (question_text, question_weight, criterion_items) in enumerate(
        question_definitions
    ):
        _create_question(
            db=db,
            exam=exam,
            question_text=question_text,
            question_weight=question_weight,
            position=position,
            criterion_items=criterion_items,
        )

    db.commit()

    # Reload to ensure the response contains all newly associated relationships.
    return db.query(Exam).filter(Exam.id == exam.id).first()


@router.get("", response_model=list[ExamResponse])
def list_exams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exams = (
        db.query(Exam)
        .options(selectinload(Exam.classrooms))
        .order_by(Exam.id.desc())
        .all()
    )
    return [exam for exam in exams if can_access_exam(db, current_user, exam)]


@router.get("/{exam_id}", response_model=ExamResponse)
def get_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exam = (
        db.query(Exam)
        .options(selectinload(Exam.classrooms))
        .filter(Exam.id == exam_id)
        .first()
    )
    if exam is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ujian tidak ditemukan.",
        )
    ensure_exam_access_or_404(db, current_user, exam)
    return exam


@router.patch("/{exam_id}", response_model=ExamResponse)
def update_exam(
    exam_id: int,
    payload: ExamUpdate,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    exam = (
        db.query(Exam)
        .options(selectinload(Exam.classrooms))
        .filter(Exam.id == exam_id)
        .first()
    )
    if exam is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ujian tidak ditemukan.",
        )
    ensure_exam_access_or_404(db, teacher, exam)

    updates = payload.model_dump(exclude_unset=True)
    if not updates or any(value is None for value in updates.values()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide valid fields to update",
        )

    for field, value in updates.items():
        setattr(exam, field, value)

    if "question" in updates:
        first_question = (
            db.query(ExamQuestion)
            .filter(ExamQuestion.exam_id == exam.id)
            .order_by(ExamQuestion.position, ExamQuestion.id)
            .first()
        )
        if first_question is not None:
            first_question.question = updates["question"]

    db.commit()
    return db.query(Exam).filter(Exam.id == exam.id).first()


@router.patch(
    "/{exam_id}/questions/{question_id}",
    response_model=ExamQuestionResponse,
)
def update_exam_question(
    exam_id: int,
    question_id: int,
    payload: ExamQuestionUpdate,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    exam = (
        db.query(Exam)
        .options(selectinload(Exam.classrooms))
        .filter(Exam.id == exam_id)
        .first()
    )
    if exam is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ujian tidak ditemukan.",
        )
    ensure_exam_access_or_404(db, teacher, exam)

    question = (
        db.query(ExamQuestion)
        .filter(
            ExamQuestion.id == question_id,
            ExamQuestion.exam_id == exam_id,
        )
        .first()
    )
    if question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found for this exam",
        )

    updates = payload.model_dump(exclude_unset=True)
    if not updates or any(value is None for value in updates.values()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide valid fields to update",
        )

    for field, value in updates.items():
        setattr(question, field, value)

    # Preserve the legacy Exam.question field for the first question.
    first_question = (
        db.query(ExamQuestion)
        .filter(ExamQuestion.exam_id == exam_id)
        .order_by(ExamQuestion.position, ExamQuestion.id)
        .first()
    )
    if first_question is not None and first_question.id == question.id:
        exam = db.query(Exam).filter(Exam.id == exam_id).first()
        exam.question = question.question

    db.commit()
    db.refresh(question)
    return question


@router.patch(
    "/{exam_id}/criteria/{criterion_id}",
    response_model=CriterionResponse,
)
def update_criterion(
    exam_id: int,
    criterion_id: int,
    payload: CriterionUpdate,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    exam = (
        db.query(Exam)
        .options(selectinload(Exam.classrooms))
        .filter(Exam.id == exam_id)
        .first()
    )
    if exam is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ujian tidak ditemukan.",
        )
    ensure_exam_access_or_404(db, teacher, exam)

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
    if not updates or any(value is None for value in updates.values()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide valid fields to update",
        )

    for field, value in updates.items():
        setattr(criterion, field, value)

    db.commit()
    db.refresh(criterion)
    return criterion


@router.delete(
    "/{exam_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    exam = (
        db.query(Exam)
        .options(selectinload(Exam.classrooms))
        .filter(Exam.id == exam_id)
        .first()
    )
    if exam is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ujian tidak ditemukan.",
        )
    ensure_exam_access_or_404(db, teacher, exam)

    db.delete(exam)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
