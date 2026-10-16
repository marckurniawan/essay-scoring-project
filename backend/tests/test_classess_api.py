from app.models import SchoolClass


EXAM_PAYLOAD = {
    "title": "Ujian Kelas",
    "question": "Jelaskan konsep overfitting.",
    "criteria": [
        {
            "label": "Konsep",
            "description": "Menjelaskan konsep dengan tepat.",
            "weight": 100,
            "max_score": 100,
        }
    ],
}


def test_teacher_can_create_list_and_view_class(client, auth_state):
    auth_state["user"] = auth_state["teacher"]

    create_response = client.post(
        "/api/classes",
        json={"name": "AI Fundamentals - A"},
    )

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["name"] == "AI Fundamentals - A"
    assert len(created["invite_code"]) == 8
    assert created["teacher_id"] == auth_state["teacher"].id
    assert created["student_count"] == 0
    assert created["exam_count"] == 0
    assert created["average_score"] is None

    list_response = client.get("/api/classes")
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()] == [created["id"]]

    detail_response = client.get(f"/api/classes/{created['id']}")
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["students"] == []
    assert detail["exams"] == []


def test_teacher_cannot_create_duplicate_class_name(client, auth_state):
    auth_state["user"] = auth_state["teacher"]

    first = client.post("/api/classes", json={"name": "Kelas A"})
    second = client.post("/api/classes", json={"name": " Kelas A "})

    assert first.status_code == 201
    assert second.status_code == 409


def test_student_cannot_manage_classes(client, auth_state):
    auth_state["user"] = auth_state["student"]

    create_response = client.post(
        "/api/classes",
        json={"name": "Kelas Siswa"},
    )
    list_response = client.get("/api/classes")

    assert create_response.status_code == 403
    assert list_response.status_code == 403


def test_exam_can_be_assigned_to_teacher_owned_class(client, auth_state):
    auth_state["user"] = auth_state["teacher"]
    class_response = client.post("/api/classes", json={"name": "Kelas Ujian"})
    classroom = class_response.json()

    exam_response = client.post(
        "/api/exams",
        json={**EXAM_PAYLOAD, "class_id": classroom["id"]},
    )

    assert exam_response.status_code == 201
    exam = exam_response.json()
    assert exam["class_id"] == classroom["id"]

    detail_response = client.get(f"/api/classes/{classroom['id']}")
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["exam_count"] == 1
    assert detail["exams"][0]["id"] == exam["id"]
    assert detail["exams"][0]["title"] == "Ujian Kelas"


def test_teacher_cannot_assign_exam_to_another_teachers_class(client, auth_state):
    auth_state["user"] = auth_state["teacher"]

    # Create a class record owned by a different teacher in the test database.
    from app.database import get_db
    from app.main import app
    from app.models import User

    override = app.dependency_overrides[get_db]
    db_generator = override()
    db = next(db_generator)
    try:
        other_teacher = User(
            name="Other Teacher",
            email="other-teacher@example.com",
            password_hash="not-used-in-this-test",
            role="teacher",
        )
        db.add(other_teacher)
        db.flush()
        other_class = SchoolClass(
            name="Kelas Privat",
            teacher_id=other_teacher.id,
            invite_code="ZXCVBN23",
        )
        db.add(other_class)
        db.commit()
        other_class_id = other_class.id
    finally:
        db_generator.close()

    response = client.post(
        "/api/exams",
        json={**EXAM_PAYLOAD, "class_id": other_class_id},
    )

    assert response.status_code == 404


def test_class_statistics_use_latest_graded_attempt_per_student_and_exam(
    client,
    auth_state,
):
    auth_state["user"] = auth_state["teacher"]
    classroom = client.post(
        "/api/classes",
        json={"name": "Kelas Statistik"},
    ).json()
    exam = client.post(
        "/api/exams",
        json={**EXAM_PAYLOAD, "class_id": classroom["id"]},
    ).json()

    from app.database import get_db
    from app.main import app
    from app.models import Exam, Submission, User

    db_generator = app.dependency_overrides[get_db]()
    db = next(db_generator)
    try:
        student = db.query(User).filter(User.id == auth_state["student"].id).first()
        db_class = db.query(SchoolClass).filter(SchoolClass.id == classroom["id"]).first()
        db_exam = db.query(Exam).filter(Exam.id == exam["id"]).first()
        db_class.students.append(student)

        db.add_all(
            [
                Submission(
                    exam_id=db_exam.id,
                    student_id=student.id,
                    student_answer="Jawaban percobaan pertama",
                    final_score=55,
                    status="graded",
                ),
                Submission(
                    exam_id=db_exam.id,
                    student_id=student.id,
                    student_answer="Jawaban percobaan terbaru",
                    final_score=95,
                    status="graded",
                ),
            ]
        )
        db.commit()
    finally:
        db_generator.close()

    detail = client.get(f"/api/classes/{classroom['id']}")
    assert detail.status_code == 200
    payload = detail.json()
    assert payload["average_score"] == 95.0
    assert payload["students"][0]["average_score"] == 95.0
    assert payload["students"][0]["completed_exams"] == 1
    assert payload["exams"][0]["average_score"] == 95.0
    assert payload["exams"][0]["completed_students"] == 1


def test_student_can_only_see_exams_assigned_to_their_class(client, auth_state):
    auth_state["user"] = auth_state["teacher"]
    classroom = client.post(
        "/api/classes",
        json={"name": "Kelas Khusus"},
    ).json()
    exam = client.post(
        "/api/exams",
        json={**EXAM_PAYLOAD, "class_id": classroom["id"]},
    ).json()

    auth_state["user"] = auth_state["student"]
    assert client.get("/api/exams").json() == []
    assert client.get(f"/api/exams/{exam['id']}").status_code == 404
    assert client.post(f"/api/exams/{exam['id']}/attempts").status_code == 404

    from app.database import get_db
    from app.main import app
    from app.models import User

    db_generator = app.dependency_overrides[get_db]()
    db = next(db_generator)
    try:
        student = db.query(User).filter(User.id == auth_state["student"].id).first()
        db_class = db.query(SchoolClass).filter(SchoolClass.id == classroom["id"]).first()
        db_class.students.append(student)
        db.commit()
    finally:
        db_generator.close()

    visible_exams = client.get("/api/exams")
    assert visible_exams.status_code == 200
    assert [item["id"] for item in visible_exams.json()] == [exam["id"]]
    assert client.get(f"/api/exams/{exam['id']}").status_code == 200


def test_teacher_cannot_edit_exam_owned_by_another_teacher(client, auth_state):
    from app.database import get_db
    from app.main import app
    from app.models import Exam, User

    db_generator = app.dependency_overrides[get_db]()
    db = next(db_generator)
    try:
        other_teacher = User(
            name="Other Teacher",
            email="another-teacher@example.com",
            password_hash="not-used-in-this-test",
            role="teacher",
        )
        db.add(other_teacher)
        db.flush()

        other_class = SchoolClass(
            name="Kelas Milik Guru Lain",
            teacher_id=other_teacher.id,
            invite_code="QWERTY23",
        )
        other_exam = Exam(
            title="Ujian Rahasia",
            question="Pertanyaan rahasia",
            duration_minutes=30,
        )
        db.add_all([other_class, other_exam])
        db.flush()
        other_class.exams.append(other_exam)
        db.commit()
        other_exam_id = other_exam.id
    finally:
        db_generator.close()

    auth_state["user"] = auth_state["teacher"]
    response = client.patch(
        f"/api/exams/{other_exam_id}",
        json={"title": "Diubah pihak lain"},
    )

    assert response.status_code == 404


def test_teacher_protest_list_is_limited_to_owned_class(client, auth_state):
    from app.database import get_db
    from app.main import app
    from app.models import Exam, Submission, User

    auth_state["user"] = auth_state["teacher"]
    classroom = client.post(
        "/api/classes",
        json={"name": "Kelas Protes"},
    ).json()
    exam = client.post(
        "/api/exams",
        json={**EXAM_PAYLOAD, "class_id": classroom["id"]},
    ).json()

    db_generator = app.dependency_overrides[get_db]()
    db = next(db_generator)
    try:
        student = db.query(User).filter(User.id == auth_state["student"].id).first()
        db_class = db.query(SchoolClass).filter(SchoolClass.id == classroom["id"]).first()
        db_exam = db.query(Exam).filter(Exam.id == exam["id"]).first()
        db_class.students.append(student)
        submission = Submission(
            exam_id=db_exam.id,
            student_id=student.id,
            student_answer="Jawaban yang sudah dikoreksi",
            final_score=80,
            status="graded",
        )
        db.add(submission)

        another_teacher = User(
            name="Guru Lain",
            email="protest-other-teacher@example.com",
            password_hash="not-used-in-this-test",
            role="teacher",
        )
        db.add(another_teacher)
        db.commit()
        submission_id = submission.id
        auth_state["other_teacher"] = another_teacher
    finally:
        db_generator.close()

    auth_state["user"] = auth_state["student"]
    protest_response = client.post(
        f"/api/submissions/{submission_id}/protests",
        json={"reason": "Nilai belum mempertimbangkan penjelasan saya."},
    )
    assert protest_response.status_code == 201

    auth_state["user"] = auth_state["teacher"]
    teacher_protests = client.get("/api/protests")
    assert teacher_protests.status_code == 200
    assert len(teacher_protests.json()) == 1

    auth_state["user"] = auth_state["other_teacher"]
    other_teacher_protests = client.get("/api/protests")
    assert other_teacher_protests.status_code == 200
    assert other_teacher_protests.json() == []


def test_student_performance_endpoint_returns_class_scoped_attempts(client, auth_state):
    auth_state["user"] = auth_state["teacher"]
    classroom = client.post("/api/classes", json={"name": "Kelas Performa"}).json()
    exam = client.post(
        "/api/exams",
        json={**EXAM_PAYLOAD, "class_id": classroom["id"]},
    ).json()

    from app.database import get_db
    from app.main import app
    from app.models import Exam, SchoolClass, Submission, User

    db_generator = app.dependency_overrides[get_db]()
    db = next(db_generator)
    try:
        student = db.query(User).filter(User.id == auth_state["student"].id).first()
        db_class = db.query(SchoolClass).filter(SchoolClass.id == classroom["id"]).first()
        db_exam = db.query(Exam).filter(Exam.id == exam["id"]).first()
        db_class.students.append(student)
        db.add(
            Submission(
                exam_id=db_exam.id,
                student_id=student.id,
                student_answer="Penjelasan siswa",
                final_score=88,
                status="graded",
            )
        )
        db.commit()
    finally:
        db_generator.close()

    response = client.get(
        f"/api/classes/{classroom['id']}/students/{auth_state['student'].id}"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["student"]["id"] == auth_state["student"].id
    assert payload["class_name"] == "Kelas Performa"
    assert payload["average_score"] == 88.0
    assert payload["completed_exams"] == 1
    assert payload["total_attempts"] == 1
    assert payload["attempts"][0]["exam_title"] == "Ujian Kelas"


def test_teacher_cannot_view_student_from_another_class(client, auth_state):
    auth_state["user"] = auth_state["teacher"]
    classroom = client.post("/api/classes", json={"name": "Kelas Kosong"}).json()

    response = client.get(
        f"/api/classes/{classroom['id']}/students/{auth_state['student'].id}"
    )
    assert response.status_code == 404


def test_student_protest_response_contains_the_students_class(client, auth_state):
    auth_state["user"] = auth_state["teacher"]
    classroom = client.post(
        "/api/classes",
        json={"name": "Kelas Konteks Protes"},
    ).json()
    exam = client.post(
        "/api/exams",
        json={**EXAM_PAYLOAD, "class_id": classroom["id"]},
    ).json()

    from app.database import get_db
    from app.main import app
    from app.models import Exam, Submission, User

    db_generator = app.dependency_overrides[get_db]()
    db = next(db_generator)
    try:
        student = db.query(User).filter(User.id == auth_state["student"].id).first()
        db_class = db.query(SchoolClass).filter(SchoolClass.id == classroom["id"]).first()
        db_exam = db.query(Exam).filter(Exam.id == exam["id"]).first()
        db_class.students.append(student)
        submission = Submission(
            exam_id=db_exam.id,
            student_id=student.id,
            student_answer="Jawaban siswa untuk ditinjau",
            final_score=78,
            status="graded",
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)
        submission_id = submission.id
    finally:
        db_generator.close()

    auth_state["user"] = auth_state["student"]
    response = client.post(
        f"/api/submissions/{submission_id}/protests",
        json={"reason": "Saya ingin meninjau hasil penilaian ini."},
    )

    assert response.status_code == 201
    assert response.json()["class_id"] == classroom["id"]
    assert response.json()["class_name"] == "Kelas Konteks Protes"
