
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Exam(Base):
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    question = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    criteria = relationship(
        "Criterion",
        back_populates="exam",
        cascade="all, delete-orphan",
    )
    submissions = relationship(
        "Submission",
        back_populates="exam",
        cascade="all, delete-orphan",
    )


class Criterion(Base):
    __tablename__ = "criteria"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    label = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    weight = Column(Float, nullable=False, default=0)
    max_score = Column(Integer, nullable=False, default=100)

    exam = relationship("Exam", back_populates="criteria")
    results = relationship(
        "CriterionResult",
        back_populates="criterion",
        cascade="all, delete-orphan",
    )


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    student_answer = Column(Text, nullable=False)
    final_score = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    exam = relationship("Exam", back_populates="submissions")
    criterion_results = relationship(
        "CriterionResult",
        back_populates="submission",
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
    criterion = relationship(
        "Criterion",
        back_populates="results",
    )
