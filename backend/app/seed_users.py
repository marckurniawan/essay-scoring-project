
import os
import secrets
from pathlib import Path

from dotenv import load_dotenv
from pwdlib import PasswordHash

from app import models  # Register all model tables before initialization.
from app.database import Base, SessionLocal, engine
from app.models import Exam, SchoolClass, User


load_dotenv(Path(__file__).resolve().parents[1] / ".env")

password_hasher = PasswordHash.recommended()


def seed_users():
    Base.metadata.create_all(bind=engine)
    users = [
        {
            "name": os.getenv("DEMO_TEACHER_NAME", "Demo Teacher"),
            "email": os.getenv("DEMO_TEACHER_EMAIL", "").strip().lower(),
            "password": os.getenv("DEMO_TEACHER_PASSWORD", ""),
            "role": "teacher",
        },
        {
            "name": os.getenv("DEMO_STUDENT_NAME", "Demo Student"),
            "email": os.getenv("DEMO_STUDENT_EMAIL", "").strip().lower(),
            "password": os.getenv("DEMO_STUDENT_PASSWORD", ""),
            "role": "student",
        },
    ]

    for user in users:
        if not user["email"] or not user["password"]:
            raise RuntimeError(
                "Set the demo email and password variables in backend/.env."
            )

        if len(user["password"]) < 12:
            raise RuntimeError(
                "Demo passwords must contain at least 12 characters."
            )

    db = SessionLocal()

    try:
        for item in users:
            existing = (
                db.query(User)
                .filter(User.email == item["email"])
                .first()
            )

            if existing:
                if existing.role != item["role"]:
                    raise RuntimeError(
                        f"Existing account {item['email']} has an unexpected role."
                    )

                print(
                    f"Account {item['email']} already exists; skipping."
                )
                continue

            db.add(
                User(
                    name=item["name"],
                    email=item["email"],
                    password_hash=password_hasher.hash(item["password"]),
                    role=item["role"],
                )
            )

        db.commit()

        teacher = (
            db.query(User)
            .filter(User.email == users[0]["email"])
            .first()
        )
        student = (
            db.query(User)
            .filter(User.email == users[1]["email"])
            .first()
        )

        if teacher is not None:
            class_name = os.getenv("DEMO_CLASS_NAME", "Kelas Demo EssAI").strip()
            classroom = (
                db.query(SchoolClass)
                .filter(
                    SchoolClass.teacher_id == teacher.id,
                    SchoolClass.name == class_name,
                )
                .first()
            )
            if classroom is None:
                for _ in range(20):
                    invite_code = "".join(
                        secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
                        for _ in range(8)
                    )
                    if not db.query(SchoolClass.id).filter(
                        SchoolClass.invite_code == invite_code
                    ).first():
                        break
                else:
                    raise RuntimeError("Unable to generate a demo class invite code.")

                classroom = SchoolClass(
                    name=class_name,
                    teacher_id=teacher.id,
                    invite_code=invite_code,
                )
                db.add(classroom)
                db.flush()

            if student is not None and student.role == "student" and student.classroom is None:
                classroom.students.append(student)

            db.commit()
            print(f"Demo class: {classroom.name} (invite code: {classroom.invite_code})")

        print("Demo user seeding completed.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed_users()
