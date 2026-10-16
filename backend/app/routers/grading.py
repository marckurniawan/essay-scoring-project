from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.class_access import ensure_exam_access_or_404
from app.database import get_db
from app.models import (
    Criterion,
    CriterionResult,
    Exam,
    ExamQuestion,
    QuestionSubmission,
    Submission,
    User,
)
from app.schemas import (
    GradingResponse,
    SubmissionAttemptResponse,
    SubmissionCreate,
    SubmissionDraftUpdate,
)
from app.security import require_role
from app.services.llm_grader import (
    LLMConfigurationError,
    LLMGradingError,
    grade_answer,
)
from app.services.scoring import calculate_final_score


router = APIRouter(prefix="/api/exams", tags=["Grading"])


# Store UTC timestamps as naive datetimes to match SQLite's DateTime behavior.
def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def get_exam_or_404(
    db: Session,
    exam_id: int,
    current_user: User,
) -> Exam:
    exam = (
        db.query(Exam)
        .options(
            joinedload(Exam.questions).joinedload(ExamQuestion.criteria),
            joinedload(Exam.classrooms),
        )
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


def get_ordered_questions(db: Session, exam: Exam) -> list[ExamQuestion]:
    questions = (
        db.query(ExamQuestion)
        .options(joinedload(ExamQuestion.criteria))
        .filter(ExamQuestion.exam_id == exam.id)
        .order_by(ExamQuestion.position, ExamQuestion.id)
        .all()
    )

    # Compatibility fallback for an old exam that has not been backfilled.
    if not questions:
        question = ExamQuestion(
            exam_id=exam.id,
            question=exam.question,
            weight=100,
            position=0,
        )
        db.add(question)
        db.flush()

        legacy_criteria = (
            db.query(Criterion)
            .filter(Criterion.exam_id == exam.id)
            .all()
        )
        for criterion in legacy_criteria:
            if criterion.question_id is None:
                criterion.question_id = question.id

        db.flush()
        questions = (
            db.query(ExamQuestion)
            .options(joinedload(ExamQuestion.criteria))
            .filter(ExamQuestion.exam_id == exam.id)
            .order_by(ExamQuestion.position, ExamQuestion.id)
            .all()
        )

    return questions


def find_active_attempt(
    db: Session,
    exam_id: int,
    student_id: int,
) -> Submission | None:
    return (
        db.query(Submission)
        .options(joinedload(Submission.question_answers))
        .filter(
            Submission.exam_id == exam_id,
            Submission.student_id == student_id,
            Submission.status == "in_progress",
        )
        .order_by(Submission.started_at.desc(), Submission.id.desc())
        .first()
    )


def sync_question_answers(
    db: Session,
    attempt: Submission,
    questions: list[ExamQuestion],
) -> list[QuestionSubmission]:
    existing = {
        item.question_id: item
        for item in db.query(QuestionSubmission)
        .filter(QuestionSubmission.submission_id == attempt.id)
        .all()
    }

    for question in questions:
        if question.id not in existing:
            answer = QuestionSubmission(
                submission_id=attempt.id,
                question_id=question.id,
                student_answer="",
            )
            db.add(answer)
            existing[question.id] = answer

    db.flush()
    ordered_answers = []
    for question in questions:
        answer = existing.get(question.id)
        if answer is not None:
            ordered_answers.append(answer)
    return ordered_answers


def aggregate_answers(
    questions: list[ExamQuestion],
    answers: list[QuestionSubmission],
) -> str:
    answer_by_question = {answer.question_id: answer.student_answer for answer in answers}
    if len(questions) == 1:
        return answer_by_question.get(questions[0].id, "")

    sections = []
    for index, question in enumerate(questions, start=1):
        sections.append(
            f"Question {index}: {question.question}\n"
            f"{answer_by_question.get(question.id, '')}"
        )
    return "\n\n".join(sections)


def serialize_attempt(
    attempt: Submission,
    questions: list[ExamQuestion],
    answers: list[QuestionSubmission],
) -> dict:
    answer_by_question = {answer.question_id: answer for answer in answers}
    question_results = []

    for question in questions:
        answer = answer_by_question.get(question.id)
        if answer is None:
            continue
        question_results.append(
            {
                "question_submission_id": answer.id,
                "question_id": question.id,
                "question": question.question,
                "weight": question.weight,
                "student_answer": answer.student_answer,
                "question_score": answer.question_score,
            }
        )

    return {
        "id": attempt.id,
        "exam_id": attempt.exam_id,
        "student_answer": attempt.student_answer,
        "started_at": attempt.started_at,
        "deadline_at": attempt.deadline_at,
        "status": attempt.status,
        "questions": question_results,
    }


def get_attempt_or_404(
    db: Session,
    exam_id: int,
    submission_id: int,
    student_id: int,
) -> Submission:
    attempt = (
        db.query(Submission)
        .filter(
            Submission.id == submission_id,
            Submission.exam_id == exam_id,
            Submission.student_id == student_id,
            Submission.status == "in_progress",
        )
        .first()
    )
    if attempt is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active exam attempt not found",
        )
    if attempt.deadline_at is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This attempt has no deadline",
        )
    return attempt


def validate_question_rubrics(questions: list[ExamQuestion]) -> None:
    if not questions:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This exam has no questions",
        )

    if sum(float(question.weight) for question in questions) <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one question must have a positive weight",
        )

    for question in questions:
        if not question.criteria:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Question {question.id} has no rubric criteria",
            )
        if question.weight > 0 and not any(
            criterion.weight > 0 for criterion in question.criteria
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Question {question.id} has a positive question weight but "
                    "no criterion with a positive weight"
                ),
            )


@router.post(
    "/{exam_id}/attempts",
    response_model=SubmissionAttemptResponse,
)
def start_exam_attempt(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student")),
):
    exam = get_exam_or_404(db, exam_id, current_user)
    questions = get_ordered_questions(db, exam)

    existing_attempt = find_active_attempt(db, exam_id, current_user.id)
    if existing_attempt is not None:
        answers = sync_question_answers(db, existing_attempt, questions)
        existing_attempt.student_answer = aggregate_answers(questions, answers)
        db.commit()
        db.refresh(existing_attempt)
        return serialize_attempt(existing_attempt, questions, answers)

    started_at = utc_now()
    attempt = Submission(
        exam_id=exam.id,
        student_id=current_user.id,
        student_answer="",
        final_score=None,
        started_at=started_at,
        deadline_at=started_at + timedelta(minutes=exam.duration_minutes),
        status="in_progress",
    )
    db.add(attempt)
    db.flush()

    answers = sync_question_answers(db, attempt, questions)
    attempt.student_answer = aggregate_answers(questions, answers)
    db.commit()
    db.refresh(attempt)

    return serialize_attempt(attempt, questions, answers)


@router.get(
    "/{exam_id}/attempts/me",
    response_model=SubmissionAttemptResponse,
)
def get_my_exam_attempt(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student")),
):
    exam = get_exam_or_404(db, exam_id, current_user)
    questions = get_ordered_questions(db, exam)
    attempt = find_active_attempt(db, exam_id, current_user.id)

    if attempt is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active attempt found",
        )

    answers = sync_question_answers(db, attempt, questions)
    db.commit()
    return serialize_attempt(attempt, questions, answers)


@router.patch(
    "/{exam_id}/submissions/{submission_id}/questions/{question_id}/draft",
    response_model=SubmissionAttemptResponse,
)
def save_question_draft(
    exam_id: int,
    submission_id: int,
    question_id: int,
    payload: SubmissionDraftUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student")),
):
    exam = get_exam_or_404(db, exam_id, current_user)
    attempt = get_attempt_or_404(
        db, exam_id, submission_id, current_user.id
    )

    if utc_now() >= attempt.deadline_at:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Time is up. The draft can no longer be changed.",
        )

    questions = get_ordered_questions(db, exam)
    question = next((item for item in questions if item.id == question_id), None)
    if question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found for this exam",
        )

    answer = (
        db.query(QuestionSubmission)
        .filter(
            QuestionSubmission.submission_id == attempt.id,
            QuestionSubmission.question_id == question.id,
        )
        .first()
    )
    if answer is None:
        answer = QuestionSubmission(
            submission_id=attempt.id,
            question_id=question.id,
            student_answer=payload.student_answer,
        )
        db.add(answer)
    else:
        answer.student_answer = payload.student_answer

    db.flush()
    answers = sync_question_answers(db, attempt, questions)
    attempt.student_answer = aggregate_answers(questions, answers)
    db.commit()
    db.refresh(attempt)
    answers = sync_question_answers(db, attempt, questions)
    return serialize_attempt(attempt, questions, answers)


# Backward-compatible draft endpoint for the old one-question frontend.
@router.patch(
    "/{exam_id}/submissions/{submission_id}/draft",
    response_model=SubmissionAttemptResponse,
)
def save_submission_draft(
    exam_id: int,
    submission_id: int,
    payload: SubmissionDraftUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student")),
):
    exam = get_exam_or_404(db, exam_id, current_user)
    attempt = get_attempt_or_404(
        db, exam_id, submission_id, current_user.id
    )
    if utc_now() >= attempt.deadline_at:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Time is up. The draft can no longer be changed.",
        )

    questions = get_ordered_questions(db, exam)
    if len(questions) != 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Use the question-specific draft endpoint for multi-question exams.",
        )

    answers = sync_question_answers(db, attempt, questions)
    answers[0].student_answer = payload.student_answer
    attempt.student_answer = payload.student_answer
    db.commit()
    db.refresh(attempt)
    answers = sync_question_answers(db, attempt, questions)
    return serialize_attempt(attempt, questions, answers)


@router.post(
    "/{exam_id}/submissions",
    response_model=GradingResponse,
    status_code=status.HTTP_201_CREATED,
)
def grade_submission(
    exam_id: int,
    payload: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student")),
):
    exam = get_exam_or_404(db, exam_id, current_user)
    questions = get_ordered_questions(db, exam)
    attempt = find_active_attempt(db, exam_id, current_user.id)

    if attempt is None or attempt.deadline_at is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Start this exam before submitting an answer.",
        )

    validate_question_rubrics(questions)
    answer_rows = sync_question_answers(db, attempt, questions)
    answer_by_question_id = {
        answer.question_id: answer for answer in answer_rows
    }
    question_by_id = {question.id: question for question in questions}
    now = utc_now()
    deadline_passed = now >= attempt.deadline_at

    # Before the deadline, accept the answer payload and persist every draft first.
    # After the deadline, deliberately ignore incoming text and grade saved drafts only.
    if not deadline_passed:
        if payload.answers is not None:
            submitted_answers = {
                item.question_id: item.student_answer
                for item in payload.answers
            }
            expected_ids = set(question_by_id)
            submitted_ids = set(submitted_answers)
            if submitted_ids != expected_ids:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Provide exactly one answer for every question in this exam.",
                )
        else:
            if len(questions) != 1:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Multi-question exams require one answer per question.",
                )
            submitted_answers = {questions[0].id: payload.student_answer or ""}

        if any(not answer.strip() for answer in submitted_answers.values()):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Answer every question before submitting the exam.",
            )

        for question_id, answer_text in submitted_answers.items():
            answer_by_question_id[question_id].student_answer = answer_text

        attempt.student_answer = aggregate_answers(questions, answer_rows)
        db.commit()
        db.refresh(attempt)
        # Refresh in case SQLAlchemy expired the relationship during commit.
        answer_rows = sync_question_answers(db, attempt, questions)
        answer_by_question_id = {
            answer.question_id: answer for answer in answer_rows
        }

    # Validate scoreable questions before spending any Gemini requests.
    for question in questions:
        if question.weight > 0 and not any(
            criterion.weight > 0 for criterion in question.criteria
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Question {question.id} has a positive question weight but "
                    "no criterion with a positive weight"
                ),
            )

    try:
        per_question_results: list[dict] = []
        flat_criterion_results: list[dict] = []
        weighted_total = 0.0
        total_question_weight = 0.0

        for question in questions:
            answer_row = answer_by_question_id[question.id]
            criteria = sorted(question.criteria, key=lambda item: item.id)
            if not criteria:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Question {question.id} has no rubric criteria",
                )

            criteria_payload = [
                {
                    "criterion_id": criterion.id,
                    "label": criterion.label,
                    "description": criterion.description,
                }
                for criterion in criteria
            ]

            graded_results = grade_answer(
                question=question.question,
                student_answer=answer_row.student_answer,
                criteria=criteria_payload,
            )
            results_by_id = {
                result["criterion_id"]: result
                for result in graded_results
            }
            active_criterion_weight = sum(
                float(criterion.weight)
                for criterion in criteria
                if criterion.weight > 0
            )

            if active_criterion_weight > 0:
                question_score = calculate_final_score(criteria, graded_results)
            else:
                # A zero-weight question can still provide criterion feedback
                # even when every criterion is configured as feedback-only.
                question_score = None

            criterion_responses = []
            for criterion in criteria:
                result = results_by_id[criterion.id]
                item = {
                    "criterion_id": criterion.id,
                    "label": criterion.label,
                    "score": result["score"],
                    "reasoning": result["reasoning"],
                    "satisfied": result["satisfied"],
                    "weight": criterion.weight,
                    "included_in_final_score": criterion.weight > 0,
                }
                criterion_responses.append(item)
                flat_criterion_results.append(item)

            answer_row.question_score = question_score
            per_question_results.append(
                {
                    "question_id": question.id,
                    "question_submission_id": answer_row.id,
                    "question": question.question,
                    "weight": question.weight,
                    "question_score": question_score,
                    "student_answer": answer_row.student_answer,
                    "criterion_results": criterion_responses,
                    "_raw_results": graded_results,
                    "_criteria": criteria,
                    "_answer_row": answer_row,
                }
            )

            if question.weight > 0:
                if question_score is None:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=(
                            f"Question {question.id} contributes to the exam score "
                            "but has no active criterion weight"
                        ),
                    )
                weighted_total += question_score * float(question.weight)
                total_question_weight += float(question.weight)

        if total_question_weight <= 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="At least one question must contribute to the final score.",
            )

        final_score = weighted_total / total_question_weight

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
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    try:
        # Grading results are persisted only after every question is graded.
        # That lets the student retry if Gemini fails halfway through the exam.
        db.query(CriterionResult).filter(
            CriterionResult.submission_id == attempt.id
        ).delete(synchronize_session=False)

        response_questions = []
        for question_result in per_question_results:
            answer_row = question_result["_answer_row"]
            for criterion, result in zip(
                question_result["_criteria"],
                question_result["_raw_results"],
                strict=True,
            ):
                db.add(
                    CriterionResult(
                        submission_id=attempt.id,
                        question_submission_id=answer_row.id,
                        criterion_id=criterion.id,
                        score=result["score"],
                        reasoning=result["reasoning"],
                        satisfied=result["satisfied"],
                    )
                )

            response_questions.append(
                {
                    key: value
                    for key, value in question_result.items()
                    if not key.startswith("_")
                }
            )

        attempt.final_score = final_score
        attempt.status = "graded"
        attempt.submitted_at = utc_now()
        attempt.student_answer = aggregate_answers(questions, answer_rows)
        db.commit()
        db.refresh(attempt)

    except Exception:
        db.rollback()
        raise

    return {
        "submission_id": attempt.id,
        "exam_id": exam.id,
        "final_score": final_score,
        "created_at": attempt.created_at,
        "criterion_results": flat_criterion_results,
        "question_results": response_questions,
    }
