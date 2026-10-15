
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, UserResponse
from app.security import (
    COOKIE_NAME,
    COOKIE_SECURE,
    SESSION_DURATION_SECONDS,
    create_access_token,
    get_current_user,
    verify_password,
)


router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=UserResponse)
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    email = payload.email.strip().lower()

    user = db.query(User).filter(User.email == email).first()

    if user is None or not verify_password(
        payload.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect.",
        )

    token = create_access_token(user.id)

    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=SESSION_DURATION_SECONDS,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )

    return user


@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: User = Depends(get_current_user),
):
    return current_user


@router.post("/logout", status_code=204)
def logout():
    response = Response(status_code=204)

    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
    )

    return response
