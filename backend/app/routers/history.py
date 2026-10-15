from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import CriterionResult, ScoreProtest, Submission, User
from app.security import require_role

router = APIRouter(prefix="/api/submissions", tags=["submissions"])


def serialize_criterion_result(result: CriterionResult) -> dict:
    criterion = getattr(result, "criterion", None)
    weight = float(criterion.weight) if criterion is not None else None
    score = float(result.score) if result.score is not None else None
    included = weight is not None and weight > 0

    return {
        "criterion_id": result.criterion_id,
        "criterion_label": criterion.label if criterion is not None else None,
        "score": score,
        "reasoning": result.reasoning,
        "satisfied": result.satisfied,
        "weight": weight,
        "included": included,
        "weighted_score": score * weight if included and score is not None else None,
    }


def serialize_protest(protest: ScoreProtest | None) -> dict | None:
    if protest is None:
        return None

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
    }


@router.get("/me")
def get_my_submissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student")),
):
    submissions = (
        db.query(Submission)
        .options(
            joinedload(Submission.exam),
            joinedload(Submission.score_protest),
            joinedload(Submission.criterion_results).joinedload(CriterionResult.criterion),
            joinedload(Submission.question_answers),
        )
        .filter(Submission.student_id == current_user.id)
        .order_by(Submission.created_at.desc(), Submission.id.desc())
        .all()
    )

    response = []
    for submission in submissions:
        exam = submission.exam
        legacy_criteria = [
            serialize_criterion_result(result)
            for result in submission.criterion_results
            if result.question_submission_id is None
        ]

        question_results = []
        answer_rows = sorted(
            submission.question_answers,
            key=lambda answer: (
                answer.question.position if answer.question is not None else 0,
                answer.question_id,
            ),
        )

        for answer in answer_rows:
            question = answer.question
            if question is None:
                continue

            criterion_results = [
                serialize_criterion_result(result)
                for result in db.query(CriterionResult)
                .options(joinedload(CriterionResult.criterion))
                .filter(CriterionResult.question_submission_id == answer.id)
                .order_by(CriterionResult.id)
                .all()
            ]

            question_results.append(
                {
                    "question_submission_id": answer.id,
                    "question_id": question.id,
                    "question": question.question,
                    "weight": float(question.weight),
                    "student_answer": answer.student_answer,
                    "question_score": answer.question_score,
                    "criterion_results": criterion_results,
                }
            )

        all_criterion_results = [
            serialize_criterion_result(result)
            for result in sorted(submission.criterion_results, key=lambda result: result.id)
        ]

        response.append(
            {
                "id": submission.id,
                "exam_id": submission.exam_id,
                "exam_title": exam.title if exam is not None else None,
                "duration_minutes": exam.duration_minutes if exam is not None else None,
                "student_answer": submission.student_answer,
                "final_score": submission.final_score,
                "created_at": submission.created_at,
                "started_at": submission.started_at,
                "deadline_at": submission.deadline_at,
                "submitted_at": submission.submitted_at,
                "status": submission.status,
                "criterion_results": all_criterion_results or legacy_criteria,
                "question_results": question_results,
                "score_protest": serialize_protest(submission.score_protest),
            }
        )

    return response
