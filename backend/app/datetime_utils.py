from datetime import datetime, timezone


def to_utc_iso(value: datetime | None) -> str | None:
    """Serialize a stored datetime (naive, but always UTC — see utc_now()) to an
    ISO 8601 string with an explicit UTC marker, so browsers parse it as UTC
    instead of assuming the viewer's local timezone."""
    if value is None:
        return None

    if value.tzinfo is None:
        return f"{value.isoformat()}Z"

    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
