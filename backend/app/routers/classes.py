import secrets
import string
from statistics import fmean

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import get_db
from app.datetime_utils import to_utc_iso
from app.models import (
    CriterionResult,
    QuestionSubmission,
    SchoolClass,
    Submission,
    User,
)
from app.routers.history import serialize_criterion_result, serialize_protest
from app.schemas import (
    ClassCreate,
    ClassDetailResponse,
    ClassExamSummary,
    ClassResponse,
    ClassStudentSummary,
)
from app.security import require_role


router = APIRouter(prefix="/api/classes", tags=["Kelas"])
INVITE_CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
INVITE_CODE_LENGTH = 8


def _generate_invite_code(db: Session) -> str:
    for _ in range(20):
        code = "".join(
            secrets.choice(INVITE_CODE_CHARACTERS)
            for _ in range(INVITE_CODE_LENGTH)
        )
        exists = db.query(SchoolClass.id).filter(SchoolClass.invite_code == code).first()
        if exists is None:
            return code

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Kode kelas belum dapat dibuat. Silakan coba kembali.",
    )


def _latest_graded_submissions(
    db: Session,
    student_ids: list[int],
    exam_ids: list[int],
) -> list[Submission]:
    if not student_ids or not exam_ids:
        return []

    submissions = (
        db.query(Submission)
        .filter(
            Submission.student_id.in_(student_ids),
            Submission.exam_id.in_(exam_ids),
            Submission.status == "graded",
            Submission.final_score.isnot(None),
        )
        .order_by(Submission.created_at.desc(), Submission.id.desc())
        .all()
    )

    # Count the latest completed attempt for each student and exam, so retrying
    # an exam does not inflate the class average or the number of exams taken.
    latest_by_student_exam: dict[tuple[int, int], Submission] = {}
    for submission in submissions:
        key = (submission.student_id, submission.exam_id)
        latest_by_student_exam.setdefault(key, submission)

    return list(latest_by_student_exam.values())


def _average(scores: list[float]) -> float | None:
    return round(fmean(scores), 2) if scores else None


def _build_class_response(
    db: Session,
    classroom: SchoolClass,
    include_details: bool = False,
) -> dict:
    students = sorted(classroom.students, key=lambda student: student.name.casefold())
    exams = sorted(classroom.exams, key=lambda exam: exam.id, reverse=True)
    student_ids = [student.id for student in students]
    exam_ids = [exam.id for exam in exams]
    latest_submissions = _latest_graded_submissions(db, student_ids, exam_ids)

    scores_by_student: dict[int, list[float]] = {student_id: [] for student_id in student_ids}
    scores_by_exam: dict[int, list[float]] = {exam_id: [] for exam_id in exam_ids}
    for submission in latest_submissions:
        score = float(submission.final_score)
        scores_by_student.setdefault(submission.student_id, []).append(score)
        scores_by_exam.setdefault(submission.exam_id, []).append(score)

    result = {
        "id": classroom.id,
        "name": classroom.name,
        "invite_code": classroom.invite_code,
        "teacher_id": classroom.teacher_id,
        "created_at": classroom.created_at,
        "student_count": len(students),
        "exam_count": len(exams),
        "average_score": _average([float(item.final_score) for item in latest_submissions]),
    }

    if include_details:
        completed_by_student = {student_id: 0 for student_id in student_ids}
        completed_by_exam = {exam_id: 0 for exam_id in exam_ids}
        for submission in latest_submissions:
            completed_by_student[submission.student_id] = (
                completed_by_student.get(submission.student_id, 0) + 1
            )
            completed_by_exam[submission.exam_id] = (
                completed_by_exam.get(submission.exam_id, 0) + 1
            )

        result["students"] = [
            ClassStudentSummary(
                id=student.id,
                name=student.name,
                email=student.email,
                completed_exams=completed_by_student.get(student.id, 0),
                average_score=_average(scores_by_student.get(student.id, [])),
            ).model_dump()
            for student in students
        ]
        result["exams"] = [
            ClassExamSummary(
                id=exam.id,
                title=exam.title,
                duration_minutes=exam.duration_minutes,
                created_at=exam.created_at,
                completed_students=completed_by_exam.get(exam.id, 0),
                average_score=_average(scores_by_exam.get(exam.id, [])),
            ).model_dump()
            for exam in exams
        ]

    return result


def _get_teacher_class_or_404(
    db: Session,
    class_id: int,
    teacher_id: int,
) -> SchoolClass:
    classroom = (
        db.query(SchoolClass)
        .options(
            selectinload(SchoolClass.students),
            selectinload(SchoolClass.exams),
        )
        .filter(
            SchoolClass.id == class_id,
            SchoolClass.teacher_id == teacher_id,
        )
        .first()
    )
    if classroom is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kelas tidak ditemukan.",
        )
    return classroom


@router.post(
    "",
    response_model=ClassResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_class(
    payload: ClassCreate,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    existing = (
        db.query(SchoolClass.id)
        .filter(
            SchoolClass.teacher_id == teacher.id,
            SchoolClass.name == payload.name,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Kamu sudah memiliki kelas dengan nama tersebut.",
        )

    classroom = SchoolClass(
        name=payload.name,
        teacher_id=teacher.id,
        invite_code=_generate_invite_code(db),
    )
    db.add(classroom)
    db.commit()
    db.refresh(classroom)

    return _build_class_response(db, classroom)


@router.get("", response_model=list[ClassResponse])
def list_classes(
    db: Session = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    classrooms = (
        db.query(SchoolClass)
        .options(
            selectinload(SchoolClass.students),
            selectinload(SchoolClass.exams),
        )
        .filter(SchoolClass.teacher_id == teacher.id)
        .order_by(SchoolClass.id.desc())
        .all()
    )
    return [_build_class_response(db, classroom) for classroom in classrooms]


@router.get("/{class_id}", response_model=ClassDetailResponse)
def get_class_detail(
    class_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    classroom = _get_teacher_class_or_404(db, class_id, teacher.id)
    return _build_class_response(db, classroom, include_details=True)


@router.get("/{class_id}/students/{student_id}")
def get_student_performance(
    class_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    classroom = _get_teacher_class_or_404(db, class_id, teacher.id)
    student = next(
        (member for member in classroom.students if member.id == student_id),
        None,
    )
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Siswa tidak ditemukan di kelas ini.",
        )

    exam_ids = [exam.id for exam in classroom.exams]
    if exam_ids:
        attempts = (
            db.query(Submission)
            .options(
                joinedload(Submission.exam),
                selectinload(Submission.score_protest),
                selectinload(Submission.criterion_results).joinedload(
                    CriterionResult.criterion
                ),
                selectinload(Submission.question_answers)
                .joinedload(QuestionSubmission.question),
                selectinload(Submission.question_answers)
                .selectinload(QuestionSubmission.criterion_results)
                .joinedload(CriterionResult.criterion),
            )
            .filter(
                Submission.student_id == student.id,
                Submission.exam_id.in_(exam_ids),
            )
            .order_by(Submission.created_at.desc(), Submission.id.desc())
            .all()
        )
        latest_graded = _latest_graded_submissions(
            db,
            [student.id],
            exam_ids,
        )
    else:
        attempts = []
        latest_graded = []

    serialized_attempts = []
    for attempt in attempts:
        questions = []
        answers = sorted(
            attempt.question_answers,
            key=lambda answer: (
                answer.question.position if answer.question is not None else 0,
                answer.question_id,
            ),
        )
        for answer in answers:
            question = answer.question
            if question is None:
                continue
            criteria = [
                serialize_criterion_result(result)
                for result in sorted(
                    answer.criterion_results,
                    key=lambda result: result.id,
                )
            ]
            questions.append(
                {
                    "question_submission_id": answer.id,
                    "question_id": question.id,
                    "question": question.question,
                    "weight": float(question.weight),
                    "student_answer": answer.student_answer,
                    "question_score": answer.question_score,
                    "criterion_results": criteria,
                }
            )

        criterion_results = [
            serialize_criterion_result(result)
            for result in sorted(
                attempt.criterion_results,
                key=lambda result: result.id,
            )
        ]
        legacy_criterion_results = [
            serialize_criterion_result(result)
            for result in attempt.criterion_results
            if result.question_submission_id is None
        ]

        serialized_attempts.append(
            {
                "id": attempt.id,
                "exam_id": attempt.exam_id,
                "exam_title": attempt.exam.title if attempt.exam else "Ujian",
                "duration_minutes": (
                    attempt.exam.duration_minutes if attempt.exam else None
                ),
                "student_answer": attempt.student_answer,
                "final_score": attempt.final_score,
                "created_at": to_utc_iso(attempt.created_at),
                "started_at": to_utc_iso(attempt.started_at),
                "deadline_at": to_utc_iso(attempt.deadline_at),
                "submitted_at": to_utc_iso(attempt.submitted_at),
                "status": attempt.status,
                "criterion_results": criterion_results or legacy_criterion_results,
                "question_results": questions,
                "score_protest": serialize_protest(attempt.score_protest),
            }
        )

    return {
        "student": {
            "id": student.id,
            "name": student.name,
            "email": student.email,
            "created_at": to_utc_iso(student.created_at),
        },
        "class_id": classroom.id,
        "class_name": classroom.name,
        "average_score": _average(
            [float(submission.final_score) for submission in latest_graded]
        ),
        "completed_exams": len(latest_graded),
        "total_attempts": len(attempts),
        "attempts": serialized_attempts,
    }
