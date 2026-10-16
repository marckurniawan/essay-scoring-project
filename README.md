# EssAI — AI-Powered Essay Scoring

EssAI is a web platform that lets teachers build essay exams with weighted rubrics and lets students take those exams online. Every submitted answer is graded automatically by the Gemini LLM against the teacher's rubric criteria, producing a per-criterion score, reasoning, and a weighted final score. Students can review their results and file score protests; teachers can review and resolve those protests.

## Features

- **Teacher dashboard** — create exams with one or more questions, each with its own weight and rubric criteria; adjust question/criterion weights after creation.
- **Student exam flow** — timed attempts with server-side deadlines, answer autosave per question, and automatic submission when time runs out.
- **AI grading** — answers are graded against the rubric by Gemini, with automatic fallback across multiple models if one fails or is rate-limited.
- **Score history** — students can see a summary of all their results and drill into every attempt, including per-criterion feedback.
- **Score protests** — students can contest a grade; teachers review each protest and accept (with a revised score) or reject it with feedback.
- **Session-based auth** — email/password login with HTTP-only signed cookies and role-based access control (`teacher` / `student`).

## Tech stack

| Layer    | Technology |
|----------|------------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Backend  | FastAPI, SQLAlchemy, Pydantic v2, PyJWT, pwdlib (Argon2) |
| Database | SQLite (file-based, via SQLAlchemy) |
| AI       | Google Gemini (`google-genai`) |

## Project structure

```
essay-scoring-project/
├── backend/
│   ├── app/
│   │   ├── routers/        # auth, exams, grading, history, protests
│   │   ├── services/       # llm_grader.py (Gemini), scoring.py (weighted score)
│   │   ├── models.py       # SQLAlchemy models
│   │   ├── schemas.py      # Pydantic request/response models
│   │   ├── security.py     # password hashing, JWT session cookies
│   │   ├── database.py     # SQLAlchemy engine/session
│   │   ├── seed_users.py   # creates the demo teacher/student accounts
│   │   └── main.py         # FastAPI app entrypoint
│   ├── tests/               # pytest test suite
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── app/                 # Next.js routes (login, student/*, teacher/*)
    ├── components/          # shared UI components
    ├── lib/api.ts           # typed API client for the backend
    └── package.json
```

## Prerequisites

- Python 3.11+
- Node.js 20+
- A [Google Gemini API key](https://aistudio.google.com/apikey)

## Setup

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

pip install -r requirements.txt

copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux
```

Fill in `backend/.env`:

```
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.8-flash
GEMINI_FALLBACK_MODELS=gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite

APP_SECRET_KEY=a_long_random_string   # used to sign session cookies
APP_COOKIE_SECURE=false               # set to true when served over HTTPS

DEMO_TEACHER_NAME=Demo Teacher
DEMO_TEACHER_EMAIL=teacher@example.com
DEMO_TEACHER_PASSWORD=choose_a_password_12_chars_min

DEMO_STUDENT_NAME=Demo Student
DEMO_STUDENT_EMAIL=student@example.com
DEMO_STUDENT_PASSWORD=choose_a_password_12_chars_min
```

Create the database tables and seed the demo accounts:

```bash
python -m app.seed_users
```

This creates `backend/essay_scoring.db` (SQLite) and the two demo accounts above.

Start the API server:

```bash
uvicorn app.main:app --reload
```

The backend runs at `http://localhost:8000`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:3000` and talks to the backend at `http://localhost:8000` by default. To point it elsewhere, set `NEXT_PUBLIC_API_URL` in a `frontend/.env.local` file.

### 3. Log in

Open `http://localhost:3000/login` and sign in with the demo teacher or student credentials you set in `backend/.env`. Teachers land on `/teacher` (manage exams, review protests); students land on `/student` (take exams, view history).

## Running tests

```bash
cd backend
pytest
```

## Notes

- `backend/essay_scoring.db` and `.env` files are never committed (see `.gitignore`); each environment keeps its own.
- The demo passwords must be at least 12 characters — `seed_users.py` enforces this before creating accounts.
