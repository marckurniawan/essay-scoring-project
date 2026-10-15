"""Repair/backfill the multi-question SQLite schema without deleting user data.

Run from the backend directory:
    python repair_multi_question_schema.py

This script intentionally reconciles the real schema before checking/recording
its migration marker, so it can repair a database where an earlier migration
was partially applied or marked complete incorrectly.
"""
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.database import Base, engine
from app.models import (
    Criterion,
    CriterionResult,
    Exam,
    ExamQuestion,
    QuestionSubmission,
    Submission,
)

MIGRATION_VERSION = "multi_question_schema_v1"


def main() -> None:
    print(f"Database in use: {engine.url.database}")

    # Creates genuinely missing tables; it does not alter columns in existing tables.
    Base.metadata.create_all(bind=engine)

    table_names = set(inspect(engine).get_table_names())
    required_tables = {"exams", "criteria", "submissions", "criterion_results"}
    missing_tables = required_tables - table_names
    if missing_tables:
        raise RuntimeError(
            "Required tables are missing from this database: "
            + ", ".join(sorted(missing_tables))
        )

    # Add columns explicitly because create_all() does not alter existing tables.
    column_additions = {
        "criteria": {
            "question_id": (
                "INTEGER REFERENCES exam_questions(id)"
            ),
        },
        "criterion_results": {
            "question_submission_id": (
                "INTEGER REFERENCES question_submissions(id)"
            ),
        },
    }

    with engine.begin() as connection:
        for table_name, additions in column_additions.items():
            current = {
                col["name"]
                for col in inspect(connection).get_columns(table_name)
            }
            for column_name, definition in additions.items():
                if column_name in current:
                    print(f"Column {table_name}.{column_name} already exists.")
                    continue
                connection.execute(
                    text(
                        f"ALTER TABLE {table_name} "
                        f"ADD COLUMN {column_name} {definition}"
                    )
                )
                print(f"Added column {table_name}.{column_name}.")

        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version VARCHAR(100) PRIMARY KEY,
                    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )

    # Backfill is idempotent: existing questions/answers/results are reused.
    with Session(engine) as db:
        exams = db.query(Exam).order_by(Exam.id).all()
        first_question_by_exam: dict[int, ExamQuestion] = {}
        questions_by_exam: dict[int, list[ExamQuestion]] = {}

        for exam in exams:
            questions = (
                db.query(ExamQuestion)
                .filter(ExamQuestion.exam_id == exam.id)
                .order_by(ExamQuestion.position, ExamQuestion.id)
                .all()
            )

            if not questions:
                legacy_question = exam.question or "Legacy question"
                question = ExamQuestion(
                    exam_id=exam.id,
                    question=legacy_question,
                    weight=100,
                    position=0,
                )
                db.add(question)
                db.flush()
                questions = [question]
                print(f"Backfilled exam #{exam.id} as one question (weight 100).")

            first_question_by_exam[exam.id] = questions[0]
            questions_by_exam[exam.id] = questions

            criteria = (
                db.query(Criterion)
                .filter(Criterion.exam_id == exam.id)
                .all()
            )
            for criterion in criteria:
                if criterion.question_id is None:
                    criterion.question_id = questions[0].id

        db.flush()

        question_submission_by_key: dict[tuple[int, int], QuestionSubmission] = {}
        submissions = db.query(Submission).order_by(Submission.id).all()

        for submission in submissions:
            questions = questions_by_exam.get(submission.exam_id, [])
            if not questions:
                continue

            first_question = first_question_by_exam[submission.exam_id]
            for question in questions:
                question_submission = (
                    db.query(QuestionSubmission)
                    .filter(
                        QuestionSubmission.submission_id == submission.id,
                        QuestionSubmission.question_id == question.id,
                    )
                    .first()
                )

                if question_submission is None:
                    is_legacy_question = question.id == first_question.id
                    question_submission = QuestionSubmission(
                        submission_id=submission.id,
                        question_id=question.id,
                        student_answer=(submission.student_answer or "")
                        if is_legacy_question
                        else "",
                        question_score=(submission.final_score if is_legacy_question else None),
                    )
                    db.add(question_submission)
                    db.flush()

                question_submission_by_key[(submission.id, question.id)] = question_submission

        db.flush()

        results_without_question = (
            db.query(CriterionResult)
            .filter(CriterionResult.question_submission_id.is_(None))
            .all()
        )
        for result in results_without_question:
            criterion = db.get(Criterion, result.criterion_id)
            if criterion is None or criterion.question_id is None:
                continue
            question_submission = question_submission_by_key.get(
                (result.submission_id, criterion.question_id)
            )
            if question_submission is not None:
                result.question_submission_id = question_submission.id

        db.commit()

    # Record only after schema repair and data backfill succeed.
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT OR IGNORE INTO schema_migrations (version) VALUES (:version)"
            ),
            {"version": MIGRATION_VERSION},
        )

    final_inspector = inspect(engine)
    criteria_columns = {
        column["name"] for column in final_inspector.get_columns("criteria")
    }
    result_columns = {
        column["name"]
        for column in final_inspector.get_columns("criterion_results")
    }
    if "question_id" not in criteria_columns:
        raise RuntimeError("Repair incomplete: criteria.question_id is still missing.")
    if "question_submission_id" not in result_columns:
        raise RuntimeError(
            "Repair incomplete: criterion_results.question_submission_id is still missing."
        )

    print("\nMulti-question database schema repair completed successfully.")
    print("Existing exams, criteria, submissions, and score results were retained.")


if __name__ == "__main__":
    main()
