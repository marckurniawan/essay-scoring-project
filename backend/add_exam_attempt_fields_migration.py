
from sqlalchemy import inspect, text

from app.database import engine


def main() -> None:
    inspector = inspect(engine)

    if "submissions" not in inspector.get_table_names():
        raise RuntimeError(
            "Tabel 'submissions' tidak ditemukan. "
            "Periksa konfigurasi database."
        )

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("submissions")
    }

    new_columns = {
        "started_at": "DATETIME",
        "deadline_at": "DATETIME",
        "submitted_at": "DATETIME",
        "status": "VARCHAR(20) NOT NULL DEFAULT 'graded'",
    }

    with engine.begin() as connection:
        for column_name, column_definition in new_columns.items():
            if column_name in existing_columns:
                print(f"Kolom {column_name} sudah tersedia.")
                continue

            connection.execute(
                text(
                    f"ALTER TABLE submissions "
                    f"ADD COLUMN {column_name} {column_definition}"
                )
            )
            print(f"Kolom {column_name} berhasil ditambahkan.")

    print("Migrasi selesai.")


if __name__ == "__main__":
    main()
