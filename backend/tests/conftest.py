
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import User
from app.security import get_current_user


@pytest.fixture
def auth_state():
    return {
        "user": None,
        "teacher": None,
        "student": None,
    }


@pytest.fixture
def client(auth_state):
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_engine,
        expire_on_commit=False,
    )

    Base.metadata.create_all(bind=test_engine)

    with TestingSessionLocal() as db:
        teacher = User(
            name="Test Teacher",
            email="teacher-test@example.com",
            password_hash="not-used-in-this-test",
            role="teacher",
        )
        student = User(
            name="Test Student",
            email="student-test@example.com",
            password_hash="not-used-in-this-test",
            role="student",
        )

        db.add_all([teacher, student])
        db.commit()
        db.refresh(teacher)
        db.refresh(student)

        auth_state["teacher"] = teacher
        auth_state["student"] = student

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    def override_current_user():
        user = auth_state["user"]

        if user is None:
            raise HTTPException(
                status_code=401,
                detail="Please log in to continue.",
            )

        return user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_current_user

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=test_engine)
        test_engine.dispose()
