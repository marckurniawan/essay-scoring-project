
import os
from pathlib import Path

from dotenv import load_dotenv
from pwdlib import PasswordHash

from app.database import SessionLocal
from app.models import User


load_dotenv(Path(__file__).resolve().parents[1] / ".env")

password_hasher = PasswordHash.recommended()


def seed_users():
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
        print("Demo user seeding completed.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed_users()
