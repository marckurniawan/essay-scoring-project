from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


# A student belongs to one class at a time. The unique student_id constraint
# enforces that rule without adding columns to the existing users table.
class_students = Table(
    "class_students",
    Base.metadata,
    Column(
        "class_id",
        Integer,
        ForeignKey("classes.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "student_id",
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    UniqueConstraint("student_id", name="uq_class_students_single_class"),
)

# An exam may be assigned to one or more classes without duplicating the exam.
class_exams = Table(
    "class_exams",
    Base.metadata,
    Column(
        "class_id",
        Integer,
        ForeignKey("classes.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "exam_id",
        Integer,
        ForeignKey("exams.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(320), nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String(20), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    submissions = relationship(
        "Submission",
        back_populates="student",
    )

    student_protests = relationship(
        "ScoreProtest",
        back_populates="student",
        foreign_keys="ScoreProtest.student_id",
    )

    reviewed_protests = relationship(
        "ScoreProtest",
        back_populates="reviewer",
        foreign_keys="ScoreProtest.reviewed_by",
    )

    classes = relationship(
        "SchoolClass",
        back_populates="teacher",
        foreign_keys="SchoolClass.teacher_id",
        cascade="all, delete-orphan",
    )
    classroom = relationship(
        "SchoolClass",
        secondary=class_students,
        back_populates="students",
        uselist=False,
    )


class SchoolClass(Base):
    __tablename__ = "classes"
    __table_args__ = (
        UniqueConstraint("teacher_id", "name", name="uq_class_teacher_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    invite_code = Column(String(12), nullable=False, unique=True, index=True)
    created_at = Column(DateTime, server_default=func.now())

    teacher = relationship(
        "User",
        back_populates="classes",
        foreign_keys=[teacher_id],
    )
    students = relationship(
        "User",
        secondary=class_students,
        back_populates="classroom",
    )
    exams = relationship(
        "Exam",
        secondary=class_exams,
        back_populates="classrooms",
    )


class Exam(Base):
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    # Legacy field retained while existing API/UI is migrated to questions.
    question = Column(Text, nullable=False)
    duration_minutes = Column(
        Integer,
        nullable=False,
        default=30,
        server_default="30",
    )
    created_at = Column(DateTime, server_default=func.now())

    criteria = relationship(
        "Criterion",
        back_populates="exam",
        cascade="all, delete-orphan",
    )
    questions = relationship(
        "ExamQuestion",
        back_populates="exam",
        cascade="all, delete-orphan",
        order_by="ExamQuestion.position",
    )
    submissions = relationship(
        "Submission",
        back_populates="exam",
        cascade="all, delete-orphan",
    )
    classrooms = relationship(
        "SchoolClass",
        secondary=class_exams,
        back_populates="exams",
    )

    @property
    def class_id(self) -> int | None:
        """Return the first assigned class for the current single-class UI."""
        return self.classrooms[0].id if self.classrooms else None

    @property
    def class_ids(self) -> list[int]:
        """Return all assigned class IDs for clients that support multiple classes."""
        return [classroom.id for classroom in self.classrooms]


class ExamQuestion(Base):
    __tablename__ = "exam_questions"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False, index=True)
    question = Column(Text, nullable=False)
    weight = Column(Float, nullable=False, default=100, server_default="100")
    position = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime, server_default=func.now())

    exam = relationship("Exam", back_populates="questions")
    criteria = relationship(
        "Criterion",
        back_populates="question",
        cascade="all, delete-orphan",
    )
    answers = relationship(
        "QuestionSubmission",
        back_populates="question",
    )


class Criterion(Base):
    __tablename__ = "criteria"

    id = Column(Integer, primary_key=True, index=True)
    # Retained for backward compatibility and existing teacher endpoints.
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    question_id = Column(
        Integer,
        ForeignKey("exam_questions.id"),
        nullable=True,
    )
    label = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    weight = Column(Float, nullable=False, default=0)
    max_score = Column(Integer, nullable=False, default=100)

    exam = relationship("Exam", back_populates="criteria")
    question = relationship("ExamQuestion", back_populates="criteria")
    results = relationship(
        "CriterionResult",
        back_populates="criterion",
        cascade="all, delete-orphan",
    )


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    student_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )
    # Legacy aggregate answer retained for history/backward compatibility.
    student_answer = Column(Text, nullable=False)
    final_score = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    started_at = Column(DateTime, nullable=True)
    deadline_at = Column(DateTime, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    status = Column(
        String(20),
        nullable=False,
        default="graded",
        server_default="graded",
    )

    exam = relationship("Exam", back_populates="submissions")
    student = relationship(
        "User",
        back_populates="submissions",
    )
    criterion_results = relationship(
        "CriterionResult",
        back_populates="submission",
        cascade="all, delete-orphan",
    )
    question_answers = relationship(
        "QuestionSubmission",
        back_populates="submission",
        cascade="all, delete-orphan",
    )
    score_protest = relationship(
        "ScoreProtest",
        back_populates="submission",
        uselist=False,
        cascade="all, delete-orphan",
    )


class CriterionResult(Base):
    __tablename__ = "criterion_results"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(
        Integer,
        ForeignKey("submissions.id"),
        nullable=False,
    )
    question_submission_id = Column(
        Integer,
        ForeignKey("question_submissions.id"),
        nullable=True,
    )
    criterion_id = Column(
        Integer,
        ForeignKey("criteria.id"),
        nullable=False,
    )
    score = Column(Float, nullable=False)
    reasoning = Column(Text, nullable=False)
    satisfied = Column(Boolean, nullable=False)

    submission = relationship(
        "Submission",
        back_populates="criterion_results",
    )
    question_submission = relationship(
        "QuestionSubmission",
        back_populates="criterion_results",
    )
    criterion = relationship(
        "Criterion",
        back_populates="results",
    )


class QuestionSubmission(Base):
    __tablename__ = "question_submissions"
    __table_args__ = (
        UniqueConstraint(
            "submission_id",
            "question_id",
            name="uq_question_submission_per_attempt",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(
        Integer,
        ForeignKey("submissions.id"),
        nullable=False,
        index=True,
    )
    question_id = Column(
        Integer,
        ForeignKey("exam_questions.id"),
        nullable=False,
        index=True,
    )
    student_answer = Column(Text, nullable=False, default="", server_default="")
    question_score = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    submission = relationship(
        "Submission",
        back_populates="question_answers",
    )
    question = relationship(
        "ExamQuestion",
        back_populates="answers",
    )
    criterion_results = relationship(
        "CriterionResult",
        back_populates="question_submission",
    )


class ScoreProtest(Base):
    __tablename__ = "score_protests"

    id = Column(Integer, primary_key=True, index=True)

    submission_id = Column(
        Integer,
        ForeignKey("submissions.id"),
        nullable=False,
        unique=True,
    )

    student_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    criterion_id = Column(
        Integer,
        ForeignKey("criteria.id"),
        nullable=True,
    )

    reason = Column(Text, nullable=False)
    status = Column(
        String(20),
        nullable=False,
        default="pending",
    )

    original_score = Column(Float, nullable=True)
    reviewed_score = Column(Float, nullable=True)
    teacher_feedback = Column(Text, nullable=True)

    reviewed_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    created_at = Column(
        DateTime,
        server_default=func.now(),
    )

    reviewed_at = Column(DateTime, nullable=True)

    submission = relationship(
        "Submission",
        back_populates="score_protest",
    )

    student = relationship(
        "User",
        back_populates="student_protests",
        foreign_keys=[student_id],
    )

    reviewer = relationship(
        "User",
        back_populates="reviewed_protests",
        foreign_keys=[reviewed_by],
    )
