from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.database import Base, engine
from app.models import Criterion, CriterionResult, Exam, ExamQuestion, QuestionSubmission, Submission


MIGRATION_VERSION = "multi_question_schema_v1"


def main() -> None:
    # Track this migration so rerunning the script does not repeat data backfill.
    with engine.begin() as connection:
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
        already_applied = connection.execute(
            text("SELECT version FROM schema_migrations WHERE version = :version"),
            {"version": MIGRATION_VERSION},
        ).scalar_one_or_none()

    if already_applied:
        print("Multi-question migration already applied. No changes made.")
        return

    # Create only new tables. SQLAlchemy does not alter existing tables here.
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    existing_columns = {
        table_name: {column["name"] for column in inspector.get_columns(table_name)}
        for table_name in ("criteria", "criterion_results")
    }

    with engine.begin() as connection:
        if "question_id" not in existing_columns["criteria"]:
            connection.execute(
                text(
                    "ALTER TABLE criteria "
                    "ADD COLUMN question_id INTEGER REFERENCES exam_questions(id)"
                )
            )
            print("Added criteria.question_id")

        if "question_submission_id" not in existing_columns["criterion_results"]:
            connection.execute(
                text(
                    "ALTER TABLE criterion_results "
                    "ADD COLUMN question_submission_id INTEGER "
                    "REFERENCES question_submissions(id)"
                )
            )
            print("Added criterion_results.question_submission_id")

    # Backfill legacy data: each old exam had one question, so it becomes
    # question 1 with weight 100; its criteria and submission results are linked.
    with Session(engine) as db:
        exams = db.query(Exam).order_by(Exam.id).all()
        first_question_by_exam: dict[int, ExamQuestion] = {}

        for exam in exams:
            first_question = (
                db.query(ExamQuestion)
                .filter(ExamQuestion.exam_id == exam.id)
                .order_by(ExamQuestion.position, ExamQuestion.id)
                .first()
            )

            if first_question is None:
                first_question = ExamQuestion(
                    exam_id=exam.id,
                    question=exam.question,
                    weight=100,
                    position=0,
                )
                db.add(first_question)
                db.flush()
                print(f"Migrated exam #{exam.id} to one question with weight 100.")

            first_question_by_exam[exam.id] = first_question

            criteria = (
                db.query(Criterion)
                .filter(Criterion.exam_id == exam.id)
                .all()
            )
            for criterion in criteria:
                if criterion.question_id is None:
                    criterion.question_id = first_question.id

        db.flush()

        question_submission_by_key: dict[tuple[int, int], QuestionSubmission] = {}
        submissions = db.query(Submission).order_by(Submission.id).all()

        for submission in submissions:
            question = first_question_by_exam.get(submission.exam_id)
            if question is None:
                continue

            question_submission = (
                db.query(QuestionSubmission)
                .filter(
                    QuestionSubmission.submission_id == submission.id,
                    QuestionSubmission.question_id == question.id,
                )
                .first()
            )

            if question_submission is None:
                question_submission = QuestionSubmission(
                    submission_id=submission.id,
                    question_id=question.id,
                    student_answer=submission.student_answer or "",
                    question_score=submission.final_score,
                )
                db.add(question_submission)
                db.flush()

            question_submission_by_key[(submission.id, question.id)] = question_submission

        db.flush()

        criterion_results = (
            db.query(CriterionResult)
            .filter(CriterionResult.question_submission_id.is_(None))
            .all()
        )
        for result in criterion_results:
            criterion = db.get(Criterion, result.criterion_id)
            if criterion is None or criterion.question_id is None:
                continue

            question_submission = question_submission_by_key.get(
                (result.submission_id, criterion.question_id)
            )
            if question_submission is not None:
                result.question_submission_id = question_submission.id

        db.commit()

    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT OR IGNORE INTO schema_migrations (version) VALUES (:version)"
            ),
            {"version": MIGRATION_VERSION},
        )

    print("Multi-question migration completed successfully.")
    print("Existing exams, criteria, submissions, and scores were retained.")


if __name__ == "__main__":
    main()
