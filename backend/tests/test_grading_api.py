
from app.routers import grading as grading_router


def create_exam(client):
    response = client.post(
        "/api/exams",
        json={
            "title": "Test Exam",
            "question": "Explain overfitting.",
            "criteria": [
                {
                    "label": "Concept",
                    "description": "Explains the concept correctly.",
                    "weight": 50,
                    "max_score": 100,
                },
                {
                    "label": "Mitigation",
                    "description": "Explains a mitigation technique.",
                    "weight": 50,
                    "max_score": 100,
                },
            ],
        },
    )

    assert response.status_code == 201
    return response.json()


def test_create_exam_and_update_criterion_weight(client):
    exam = create_exam(client)
    mitigation = next(
        criterion
        for criterion in exam["criteria"]
        if criterion["label"] == "Mitigation"
    )

    response = client.patch(
        f"/api/exams/{exam['id']}/criteria/{mitigation['id']}",
        json={"weight": 0},
    )

    assert response.status_code == 200
    assert response.json()["weight"] == 0


def test_grading_respects_personalized_weights(client, monkeypatch):
    exam = create_exam(client)

    def fake_grade_answer(question, student_answer, criteria):
        scores = {
            "Concept": 100,
            "Mitigation": 0,
        }

        return [
            {
                "criterion_id": criterion["criterion_id"],
                "score": scores[criterion["label"]],
                "reasoning": (
                    f"Mock feedback for {criterion['label']}."
                ),
                "satisfied": scores[criterion["label"]] >= 70,
            }
            for criterion in criteria
        ]

    monkeypatch.setattr(
        grading_router,
        "grade_answer",
        fake_grade_answer,
    )

    payload = {
        "student_answer": "A sample answer for testing.",
    }

    first_response = client.post(
        f"/api/exams/{exam['id']}/submissions",
        json=payload,
    )

    assert first_response.status_code == 201
    first_result = first_response.json()

    assert first_result["final_score"] == 50.0

    mitigation = next(
        criterion
        for criterion in exam["criteria"]
        if criterion["label"] == "Mitigation"
    )

    update_response = client.patch(
        f"/api/exams/{exam['id']}/criteria/{mitigation['id']}",
        json={"weight": 0},
    )

    assert update_response.status_code == 200

    second_response = client.post(
        f"/api/exams/{exam['id']}/submissions",
        json=payload,
    )

    assert second_response.status_code == 201
    second_result = second_response.json()

    assert second_result["final_score"] == 100.0

    mitigation_result = next(
        result
        for result in second_result["criterion_results"]
        if result["criterion_id"] == mitigation["id"]
    )

    assert mitigation_result["score"] == 0
    assert mitigation_result["reasoning"]
    assert mitigation_result["weight"] == 0
    assert mitigation_result["included_in_final_score"] is False
