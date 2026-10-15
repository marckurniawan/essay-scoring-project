
from app.routers import grading as grading_router


EXAM_PAYLOAD = {
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
}


def create_exam(client):
    response = client.post("/api/exams", json=EXAM_PAYLOAD)
    assert response.status_code == 201
    return response.json()


def test_create_exam_and_update_criterion_weight(client, auth_state):
    auth_state["user"] = auth_state["teacher"]

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


def test_grading_respects_personalized_weights(
    client,
    auth_state,
    monkeypatch,
):
    auth_state["user"] = auth_state["teacher"]
    exam = create_exam(client)

    def fake_grade_answer(question, student_answer, criteria):
        scores = {"Concept": 100, "Mitigation": 0}

        return [
            {
                "criterion_id": item["criterion_id"],
                "score": scores[item["label"]],
                "reasoning": f"Mock feedback for {item['label']}.",
                "satisfied": scores[item["label"]] >= 70,
            }
            for item in criteria
        ]

    monkeypatch.setattr(
        grading_router,
        "grade_answer",
        fake_grade_answer,
    )

    payload = {"student_answer": "A sample answer for testing."}
    auth_state["user"] = auth_state["student"]

    attempt = client.post(
        f"/api/exams/{exam['id']}/attempts",
    )

    assert attempt.status_code == 200

    first = client.post(
        f"/api/exams/{exam['id']}/submissions",
        json=payload,
    )

    assert first.status_code == 201
    assert first.json()["final_score"] == 50.0

    mitigation = next(
        item for item in exam["criteria"]
        if item["label"] == "Mitigation"
    )

    auth_state["user"] = auth_state["teacher"]

    update = client.patch(
        f"/api/exams/{exam['id']}/criteria/{mitigation['id']}",
        json={"weight": 0},
    )
    assert update.status_code == 200

    auth_state["user"] = auth_state["student"]

    # Start a new attempt after the rubric weight changes.
    attempt = client.post(
        f"/api/exams/{exam['id']}/attempts",
    )

    assert attempt.status_code == 200

    second = client.post(
        f"/api/exams/{exam['id']}/submissions",
        json=payload,
    )

    assert second.status_code == 201

    assert second.status_code == 201
    result = second.json()

    assert result["final_score"] == 100.0

    mitigation_result = next(
        item for item in result["criterion_results"]
        if item["criterion_id"] == mitigation["id"]
    )

    assert mitigation_result["score"] == 0
    assert mitigation_result["reasoning"]
    assert mitigation_result["weight"] == 0
    assert mitigation_result["included_in_final_score"] is False


def test_exam_list_requires_login(client):
    response = client.get("/api/exams")
    assert response.status_code == 401


def test_student_cannot_create_exam(client, auth_state):
    auth_state["user"] = auth_state["student"]

    response = client.post("/api/exams", json=EXAM_PAYLOAD)

    assert response.status_code == 403


def test_teacher_cannot_submit_student_answer(client, auth_state):
    auth_state["user"] = auth_state["teacher"]
    exam = create_exam(client)

    response = client.post(
        f"/api/exams/{exam['id']}/submissions",
        json={"student_answer": "Test answer"},
    )

    assert response.status_code == 403
