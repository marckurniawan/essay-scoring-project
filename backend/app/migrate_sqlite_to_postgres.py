"""Copy local SQLite data into an empty PostgreSQL database.

Run from the backend directory after setting DATABASE_URL to the destination
PostgreSQL connection string:

    python -m app.migrate_sqlite_to_postgres --source ./essay_scoring.db

The destination must be empty. This script never modifies the SQLite source.
"""

import argparse
from pathlib import Path

from sqlalchemy import MetaData, create_engine, func, insert, inspect, select
from sqlalchemy.engine import Engine

from app import models  # noqa: F401 - register all models with Base.metadata
from app.database import Base, SQLALCHEMY_DATABASE_URL, engine as configured_engine


def _row_count(connection, table) -> int:
    return int(connection.execute(select(func.count()).select_from(table)).scalar_one())


def _reset_postgres_sequences(connection, tables) -> None:
    for table in tables:
        primary_keys = list(table.primary_key.columns)
        if len(primary_keys) != 1 or primary_keys[0].name != "id":
            continue
        table_name = table.name
        connection.exec_driver_sql(
            f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), "
            f"COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM \"{table_name}\""
        )


def migrate(source_path: Path, target_engine: Engine) -> None:
    if not source_path.is_file():
        raise FileNotFoundError(f"File SQLite tidak ditemukan: {source_path}")
    if target_engine.dialect.name != "postgresql":
        raise ValueError(
            "DATABASE_URL harus menunjuk ke PostgreSQL. Data sumber tidak diubah."
        )

    source_engine = create_engine(f"sqlite:///{source_path.resolve()}")
    try:
        source_inspector = inspect(source_engine)
        source_table_names = set(source_inspector.get_table_names())
        if not source_table_names:
            raise ValueError("File SQLite tidak memiliki tabel yang dapat dipindahkan.")

        # Validate any existing application tables before create_all. SQLAlchemy
        # creates missing tables but never repairs incompatible existing schemas.
        initial_inspector = inspect(target_engine)
        initial_table_names = set(initial_inspector.get_table_names())
        for table_name in initial_table_names.intersection(Base.metadata.tables):
            expected_columns = set(Base.metadata.tables[table_name].columns.keys())
            destination_columns = {
                column["name"] for column in initial_inspector.get_columns(table_name)
            }
            missing_columns = sorted(expected_columns - destination_columns)
            if missing_columns:
                raise ValueError(
                    f"Skema tabel tujuan '{table_name}' belum sesuai dengan kode saat ini "
                    f"(kolom belum ada: {', '.join(missing_columns)}). Gunakan database "
                    "PostgreSQL baru yang kosong untuk migrasi awal."
                )
                # Pastikan tabel aplikasi yang sudah ada tidak berisi data.
        existing_application_tables = [
            Base.metadata.tables[name]
            for name in initial_table_names.intersection(
                Base.metadata.tables
            )
        ]

        with target_engine.connect() as connection:
            existing_non_empty = [
                table.name
                for table in existing_application_tables
                if _row_count(connection, table) > 0
            ]

        if existing_non_empty:
            raise ValueError(
                "Database tujuan sudah berisi data. "
                "Migrasi dibatalkan. Tabel berisi data: "
                f"{', '.join(existing_non_empty)}"
            )

        Base.metadata.create_all(bind=target_engine)
        destination_inspector = inspect(target_engine)
        destination_table_names = set(destination_inspector.get_table_names())
        tables = [
            table
            for table in Base.metadata.sorted_tables
            if table.name in destination_table_names
        ]

        with target_engine.connect() as connection:
            non_empty = [table.name for table in tables if _row_count(connection, table) > 0]
        if non_empty:
            raise ValueError(
                "Database tujuan tidak kosong. Migrasi dibatalkan agar data tidak "
                f"tercampur. Tabel berisi data: {', '.join(non_empty)}"
            )

        source_metadata = MetaData()
        source_metadata.reflect(
            bind=source_engine,
            only=[name for name in source_table_names if name in Base.metadata.tables],
        )

        copied_rows: dict[str, int] = {}
        with source_engine.connect() as source_connection, target_engine.begin() as target_connection:
            for target_table in tables:
                source_table = source_metadata.tables.get(target_table.name)
                if source_table is None:
                    continue

                target_columns = {column.name for column in target_table.columns}
                shared_columns = [
                    column.name
                    for column in source_table.columns
                    if column.name in target_columns
                ]
                if not shared_columns:
                    continue

                rows = source_connection.execute(
                    select(*(source_table.c[name] for name in shared_columns))
                ).mappings().all()
                if not rows:
                    copied_rows[target_table.name] = 0
                    continue

                records = [dict(row) for row in rows]
                target_connection.execute(insert(target_table), records)
                copied_rows[target_table.name] = len(records)

            _reset_postgres_sequences(target_connection, tables)

        print("Migrasi SQLite ke PostgreSQL selesai.")
        print(f"Sumber: {source_path.resolve()}")
        print("Jumlah data yang dipindahkan:")
        for table_name, row_count in copied_rows.items():
            print(f"  {table_name}: {row_count}")
        print("File SQLite sumber tidak diubah.")
    finally:
        source_engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=Path("./essay_scoring.db"),
        help="Lokasi file SQLite sumber (default: ./essay_scoring.db)",
    )
    args = parser.parse_args()

    if not SQLALCHEMY_DATABASE_URL.startswith(("postgresql+psycopg://", "postgresql://", "postgres://")):
        raise SystemExit(
            "Set DATABASE_URL ke connection string PostgreSQL sebelum menjalankan migrasi."
        )

    migrate(args.source, configured_engine)


if __name__ == "__main__":
    main()
