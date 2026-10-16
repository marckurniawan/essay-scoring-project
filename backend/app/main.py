import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models
from app.database import Base, engine
from app.routers import auth, classes, exams, grading, history, protests

Base.metadata.create_all(bind=engine)

app = FastAPI(title="EssAI — API Penilaian Esai")

configured_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)
allowed_origins = [origin.strip() for origin in configured_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(classes.router)
app.include_router(exams.router)
app.include_router(grading.router)
app.include_router(history.router)
app.include_router(protests.router)

@app.get("/")
def health_check():
    return {"status": "ok"}
