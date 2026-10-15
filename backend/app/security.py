
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from dotenv import load_dotenv
from fastapi import Cookie, Depends, HTTPException, status
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User


load_dotenv(Path(__file__).resolve().parents[1] / ".env")

password_hash = PasswordHash.recommended()

COOKIE_NAME = "essay_session"
SESSION_DURATION_SECONDS = 12 * 60 * 60
SESSION_DURATION = timedelta(seconds=SESSION_DURATION_SECONDS)

COOKIE_SECURE = (
    os.getenv("APP_COOKIE_SECURE", "false").lower() == "true"
)


def get_secret_key() -> str:
    secret = os.getenv("APP_SECRET_KEY")

    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication is not configured.",
        )

    return secret


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return password_hash.verify(password, hashed_password)


def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + SESSION_DURATION,
    }

    return jwt.encode(
        payload,
        get_secret_key(),
        algorithm="HS256",
    )


def get_current_user(
    session_token: str | None = Cookie(
        default=None,
        alias=COOKIE_NAME,
    ),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Please log in to continue.",
    )

    if not session_token:
        raise unauthorized

    try:
        payload = jwt.decode(
            session_token,
            get_secret_key(),
            algorithms=["HS256"],
        )

        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        raise unauthorized
    except HTTPException:
        raise

    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise unauthorized

    return user

def require_role(*allowed_roles: str):
    def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )

        return current_user

    return role_checker