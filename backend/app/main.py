from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models
from app.database import Base, engine
from app.routers import auth, exams, grading, history, protests

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Essay Scoring API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(exams.router)
app.include_router(grading.router)
app.include_router(history.router)
app.include_router(protests.router)

@app.get("/")
def health_check():
    return {"status": "ok"}
