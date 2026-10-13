from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CriterionResult, Exam, Submission
from app.schemas import GradingResponse, SubmissionCreate
from app.services.llm_grader import (
    LLMConfigurationError,
    LLMGradingError,
    grade_answer,
)
from app.services.scoring import calculate_final_score


router = APIRouter(prefix="/api/exams", tags=["Grading"])


@router.post(
    "/{exam_id}/submissions",
    response_model=GradingResponse,
    status_code=status.HTTP_201_CREATED,
)
def grade_submission(
    exam_id: int,
    payload: SubmissionCreate,
    db: Session = Depends(get_db),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()

    if exam is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found",
        )

    criteria = exam.criteria

    if not criteria:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This exam has no rubric criteria",
        )

    active_weight = sum(
        float(criterion.weight)
        for criterion in criteria
        if criterion.weight > 0
    )

    if active_weight <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one criterion must have a positive weight",
        )

    criteria_payload = [
        {
            "criterion_id": criterion.id,
            "label": criterion.label,
            "description": criterion.description,
        }
        for criterion in criteria
    ]

    try:
        results = grade_answer(
            question=exam.question,
            student_answer=payload.student_answer,
            criteria=criteria_payload,
        )
    except LLMConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except LLMGradingError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    try:
        final_score = calculate_final_score(criteria, results)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    results_by_id = {
        result["criterion_id"]: result
        for result in results
    }

    submission = Submission(
        exam_id=exam.id,
        student_answer=payload.student_answer,
        final_score=final_score,
    )

    try:
        db.add(submission)
        db.flush()

        result_rows = [
            CriterionResult(
                submission_id=submission.id,
                criterion_id=criterion.id,
                score=results_by_id[criterion.id]["score"],
                reasoning=results_by_id[criterion.id]["reasoning"],
                satisfied=results_by_id[criterion.id]["satisfied"],
            )
            for criterion in criteria
        ]

        db.add_all(result_rows)
        db.commit()
        db.refresh(submission)

    except Exception:
        db.rollback()
        raise

    criterion_responses = [
        {
            "criterion_id": criterion.id,
            "label": criterion.label,
            "score": results_by_id[criterion.id]["score"],
            "reasoning": results_by_id[criterion.id]["reasoning"],
            "satisfied": results_by_id[criterion.id]["satisfied"],
            "weight": criterion.weight,
            "included_in_final_score": criterion.weight > 0,
        }
        for criterion in criteria
    ]

    return {
        "submission_id": submission.id,
        "exam_id": exam.id,
        "final_score": final_score,
        "created_at": submission.created_at,
        "criterion_results": criterion_responses,
    }