from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Exam, User, class_students


def can_access_exam(db: Session, user: User, exam: Exam) -> bool:
    """Allow legacy unassigned exams and enforce ownership for class exams."""
    if not exam.classrooms:
        return True

    if user.role == "teacher":
        return any(classroom.teacher_id == user.id for classroom in exam.classrooms)

    if user.role == "student":
        student_class_id = (
            db.query(class_students.c.class_id)
            .filter(class_students.c.student_id == user.id)
            .scalar()
        )
        return student_class_id is not None and any(
            classroom.id == student_class_id for classroom in exam.classrooms
        )

    return False


def ensure_exam_access_or_404(db: Session, user: User, exam: Exam) -> None:
    if not can_access_exam(db, user, exam):
        # 404 avoids revealing another class's exam to an unauthorized account.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ujian tidak ditemukan.",
        )
