from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models
from app.database import Base, engine
from app.routers import exams, grading


Base.metadata.create_all(bind=engine)

app = FastAPI(title="Essay Scoring API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(exams.router)
app.include_router(grading.router)


@app.get("/")
def health_check():
    return {"status": "ok"}