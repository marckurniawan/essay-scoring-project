from sqlalchemy import inspect, text

from app.database import engine


def main() -> None:
    inspector = inspect(engine)

    if "exams" not in inspector.get_table_names():
        raise RuntimeError(
            "Tabel 'exams' tidak ditemukan. "
            "Pastikan DATABASE_URL mengarah ke database yang benar."
        )

    columns = {
        column["name"]
        for column in inspector.get_columns("exams")
    }

    if "duration_minutes" in columns:
        print("Kolom duration_minutes sudah tersedia. Tidak ada perubahan.")
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                ALTER TABLE exams
                ADD COLUMN duration_minutes INTEGER
                NOT NULL DEFAULT 30
                """
            )
        )

    print("Migrasi berhasil: duration_minutes ditambahkan.")


if __name__ == "__main__":
    main()