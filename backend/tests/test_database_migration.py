import pytest
from sqlalchemy import create_engine, text, inspect

from app.migrate_sqlite_to_postgres import migrate


def test_migration_refuses_sqlite_destination_without_modifying_source(tmp_path):
    source_path = tmp_path / "source.db"
    source_engine = create_engine(f"sqlite:///{source_path}")
    with source_engine.begin() as connection:
        connection.execute(text("CREATE TABLE keep_me (id INTEGER PRIMARY KEY, value TEXT)"))
        connection.execute(text("INSERT INTO keep_me (id, value) VALUES (1, 'preserved')"))

    target_engine = create_engine("sqlite://")
    try:
        with pytest.raises(ValueError, match="PostgreSQL"):
            migrate(source_path, target_engine)

        with source_engine.connect() as connection:
            row = connection.execute(text("SELECT value FROM keep_me WHERE id = 1")).scalar_one()
        assert row == "preserved"
        assert inspect(target_engine).get_table_names() == []
    finally:
        source_engine.dispose()
        target_engine.dispose()
