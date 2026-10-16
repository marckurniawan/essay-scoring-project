from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import SchoolClass, User
from app.schemas import LoginRequest, StudentSignupRequest, UserResponse
from app.security import (
    COOKIE_NAME,
    COOKIE_SECURE,
    SESSION_DURATION_SECONDS,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)


router = APIRouter(prefix="/api/auth", tags=["Autentikasi"])


def _set_session_cookie(response: Response, user_id: int) -> None:
    token = create_access_token(user_id)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=SESSION_DURATION_SECONDS,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


@router.post("/login", response_model=UserResponse)
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == payload.email).first()

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email atau kata sandi tidak sesuai.",
        )

    _set_session_cookie(response, user.id)
    return user


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_student(
    payload: StudentSignupRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    existing_user = db.query(User.id).filter(User.email == payload.email).first()
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email sudah terdaftar. Silakan masuk menggunakan akun tersebut.",
        )

    classroom = (
        db.query(SchoolClass)
        .filter(SchoolClass.invite_code == payload.class_code)
        .first()
    )
    if classroom is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kode kelas tidak ditemukan. Periksa kembali kode dari guru.",
        )

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role="student",
    )
    classroom.students.append(user)
    db.add(user)

    try:
        db.flush()
        # Creating the session before commit makes a missing APP_SECRET_KEY
        # abort the registration rather than leave an account that cannot log in.
        _set_session_cookie(response, user.id)
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email sudah terdaftar. Silakan masuk menggunakan akun tersebut.",
        )
    except HTTPException:
        db.rollback()
        raise

    return user


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
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
