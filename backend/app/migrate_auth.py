
from sqlalchemy import inspect

from app import models
from app.database import Base, engine


def migrate():
    # Create new tables, including users, without deleting existing data.
    Base.metadata.create_all(bind=engine)

    with engine.begin() as connection:
        columns = {
            column["name"]
            for column in inspect(connection).get_columns("submissions")
        }

        if "student_id" not in columns:
            connection.exec_driver_sql(
                """
                ALTER TABLE submissions
                ADD COLUMN student_id INTEGER REFERENCES users(id)
                """
            )
            print("Added submissions.student_id")

        connection.exec_driver_sql(
            """
            CREATE INDEX IF NOT EXISTS ix_submissions_student_id
            ON submissions (student_id)
            """
        )

    print("Authentication database migration completed.")


if __name__ == "__main__":
    migrate()
