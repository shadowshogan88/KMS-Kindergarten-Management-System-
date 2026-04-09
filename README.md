# Kindergarten School Management System (Django + SQLite + React)

A modular school/kindergarten management system with a Django REST API (JWT) and a React (Vite) portal UI.

## Features

- Role-based authentication: **Admin**, **Teacher**, **Parent**
- Students + parents
- Classes/sections/subjects/teachers
- Class routine (weekly timetable) + Live class settings
- Holidays + Weekly holidays (break days)
- Academic attendance (class-wise)

## Project structure

```
kindergarten_kms/
  backend/
    manage.py
    requirements.txt
    .env.example
    kms/
      management/commands/seed_sample.py
    users/               # auth + roles
    students/            # student + parent profile
    academics/           # classes/sections/subjects/teachers (portal)
    routines/            # class routine + holidays + weekly holidays + live calendar
    attendance/          # academic attendance
    integrations/google/ # Google Calendar/Meet (optional)
  frontend/
    package.json
    src/
      routes/Routes.jsx  # portal routes
  frontend_legacy_2026-04-06/
    # backup
```

## Run locally (Windows)

### 1) Backend (Django)

From CMD:

```cmd
cd /d "<repo>\backend"
python -m venv .venv
.venv\Scripts\activate.bat
pip install -r requirements.txt
```

Create DB + tables:

```cmd
python manage.py makemigrations
python manage.py migrate
```

Optional: seed sample data:

```cmd
python manage.py seed_sample
```

Run server:

```cmd
python manage.py runserver
```

Backend URLs:
- API base: `http://127.0.0.1:8000/api/v1/`
- Admin: `http://127.0.0.1:8000/admin/`

Sample logins (after `seed_sample`):
- `admin` / `admin1234`
- `teacher` / `teacher1234`
- `parent` / `parent1234`

### 2) Frontend (React + Vite)

From PowerShell (recommended on machines where `npm.ps1` is blocked by ExecutionPolicy):

```powershell
cd "<repo>\frontend"
npm.cmd install
npm.cmd run dev
```

From CMD:

```cmd
cd /d "<repo>\frontend"
npm install
npm run dev
```

Frontend URLs:
- Home: `http://localhost:5173/`
- Portal: `http://localhost:5173/portal/`

Create `frontend/.env` (optional) to point frontend to the API:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

## Portal pages (React)

Main portal routes are defined in `frontend/src/routes/Routes.jsx`.

- `/portal/teachers`
- `/portal/class-teachers`
- `/portal/class-routine`
- `/portal/live-class`
- `/portal/holidays`
- `/portal/weekly-holidays`
- `/portal/attendance`
- `/portal/attendance-report`

## Routines + Holidays rules

- Weekly holiday configuration is stored in `WeeklyHoliday` (day indices: `0=Saturday ... 6=Friday`).
- If a day is a weekly holiday, routines are **not allowed** to be created/updated for that day, and the UI shows **“Break for Holiday”**.

## Key API endpoints (JWT)

Auth:
- `POST /api/v1/auth/token/` → `{ "username": "...", "password": "..." }`
- `POST /api/v1/auth/token/refresh/`
- `GET /api/v1/auth/me/`

Routines:
- `GET /api/v1/academic-routines/?class=<id>&section=<A>`
- `POST /api/v1/academic-routines/` (admin)
- `PATCH /api/v1/academic-routines/:id/` (admin)
- `DELETE /api/v1/academic-routines/:id/` (admin)

Holidays:
- `GET /api/v1/holidays/`
- `GET /api/v1/weekly-holidays/current/`
- `POST /api/v1/weekly-holidays/current/` (admin)
- `GET /api/v1/holiday-calendar/?start=YYYY-MM-DD&end=YYYY-MM-DD`

## Google Meet / Calendar integration (optional)

This project supports storing and displaying meeting links. If you enable Google OAuth + Calendar API,
the backend can create Calendar events with Google Meet links.

Configure via `backend/.env` (copy from `backend/.env.example`).

## Update README on GitHub

After editing `README.md`, push to GitHub:

```powershell
git status
git add README.md
git commit -m "Update README"
git push
```
