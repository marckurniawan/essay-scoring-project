def test_student_signup_uses_invite_code_and_sets_student_role(
    client,
    auth_state,
    monkeypatch,
):
    from app.routers import auth as auth_router

    monkeypatch.setattr(auth_router, "hash_password", lambda password: f"hashed:{password}")
    monkeypatch.setattr(auth_router, "create_access_token", lambda user_id: f"token:{user_id}")
    auth_state["user"] = auth_state["teacher"]
    classroom_response = client.post("/api/classes", json={"name": "Kelas Pendaftaran"})
    assert classroom_response.status_code == 201
    invite_code = classroom_response.json()["invite_code"]

    auth_state["user"] = None
    response = client.post(
        "/api/auth/register",
        json={
            "name": " Siswa Baru ",
            "email": "  SISWA.BARU@example.com ",
            "password": "kata-sandi-aman-123",
            "class_code": invite_code.lower(),
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Siswa Baru"
    assert data["email"] == "siswa.baru@example.com"
    assert data["role"] == "student"
    assert "essay_session" in response.cookies

    from app.database import get_db
    from app.main import app
    from app.models import SchoolClass, User

    db_generator = app.dependency_overrides[get_db]()
    db = next(db_generator)
    try:
        student = db.query(User).filter(User.email == "siswa.baru@example.com").first()
        classroom = db.query(SchoolClass).filter(SchoolClass.invite_code == invite_code).first()
        assert student is not None
        assert student.password_hash == "hashed:kata-sandi-aman-123"
        assert student.role == "student"
        assert [member.id for member in classroom.students] == [student.id]
    finally:
        db_generator.close()


def test_student_signup_rejects_invalid_class_code(client, monkeypatch):
    from app.routers import auth as auth_router

    monkeypatch.setattr(auth_router, "hash_password", lambda password: "hashed")
    monkeypatch.setattr(auth_router, "create_access_token", lambda user_id: f"token:{user_id}")

    response = client.post(
        "/api/auth/register",
        json={
            "name": "Siswa Baru",
            "email": "siswa-invalid@example.com",
            "password": "kata-sandi-aman-123",
            "class_code": "ABCDEFGH",
        },
    )
    assert response.status_code == 400
    assert "Kode kelas" in response.json()["detail"]


def test_student_signup_rejects_short_password(client):
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Siswa Baru",
            "email": "siswa-pendek@example.com",
            "password": "singkat",
            "class_code": "ABCDEFGH",
        },
    )
    assert response.status_code == 422
