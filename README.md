# Kindergarten School Management System (Django + SQLite + React)

Beginner-friendly, modular, and “professional” starter project for a kindergarten:
- Role-based authentication: **Admin**, **Teacher**, **Parent**
- Student profile: photo + medical info + parent details
- Parent dashboard: daily activity + attendance + progress
- Teacher dashboard: classroom overview (and API/admin tools for attendance + reports)
- Live class (Google Meet): store + display meeting links
- Daily activity report: food, sleep, mood, learning, teacher notes
- Media upload: photos/videos attached to daily reports
- Notifications: announcements/reminders

Note: The current `frontend/` is a Tailwick-based dashboard UI template. The `/portal/` page is wired to Django JWT login, but the rest of the dashboard pages are still UI-only (no live data fetch yet).

## Project structure

```
kindergarten_kms/
  backend/
    manage.py
    requirements.txt
    .env.example
    kms/
      settings.py
      urls.py
      api_views.py
      management/commands/seed_sample.py
    users/           # auth + roles
      models.py
      views.py
      urls.py
    students/        # student + parent profile
      models.py
      views.py
      urls.py
    classes/         # classrooms + enrollment + live class (meet link)
      models.py
      views.py
      urls.py
    attendance/      # attendance per day
      models.py
      views.py
      urls.py
    reports/         # daily activity + media + progress notes
      models.py
      views.py
      urls.py
    notifications/   # announcements/reminders
      models.py
      views.py
      urls.py
  frontend/
    # Tailwick dashboard (current UI)
    package.json
    src/
      ...
  frontend_legacy_2026-04-06/
    # Previous React app (kept as backup)
    package.json
    src/
      ...
```

## 1) Run backend (Django) on Windows CMD

Open CMD:

```cmd
cd /d "C:\Users\SAFI ENTERPRISE\Desktop\dipti\school\kindergarten_kms\backend"
python -m venv .venv
.venv\Scripts\activate.bat
pip install -r requirements.txt
```

Default settings module is `kms.settings.dev` (good for local development).

Create database + tables:

```cmd
python manage.py makemigrations
python manage.py migrate
```

Create sample data:

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

Sample logins:
- `admin` / `admin1234`
- `teacher` / `teacher1234`
- `parent` / `parent1234`

## 2) Run frontend (React)

Open another PowerShell (recommended on this machine):

```powershell
cd "C:\Users\SAFI ENTERPRISE\Desktop\dipti\school\kindergarten_kms\frontend"
npm.cmd install
npm.cmd run dev
```

If you prefer CMD:

```cmd
cd /d "C:\Users\SAFI ENTERPRISE\Desktop\dipti\school\kindergarten_kms\frontend"
npm install
npm run dev
```

Frontend URL:
- `http://localhost:5173/`
- Portal login page: `http://localhost:5173/portal/`

When you connect the UI to Django later, you can add `kindergarten_kms/frontend/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

For this project the recommended value is:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

## Google Meet integration (simple + secure)

This project **stores** meeting links (does not auto-generate them).

Recommended workflow:
1. Create a Google Meet link (manual Meet or Google Calendar event)
2. Put it into `classes.LiveClass.meet_link` (via Django Admin or API)
3. Parents/Teachers open “Live Class” page and click “Join Google Meet”

If you want **auto-create Meet links**, the usual approach is Google Calendar API + OAuth (can be added next).

## Key API endpoints (JWT)

Auth:
- `POST /api/v1/auth/token/` → `{ "username": "...", "password": "..." }`
- `POST /api/v1/auth/token/refresh/`
- `GET /api/v1/auth/me/`

Dashboard:
- `GET /api/v1/dashboard/`

Students:
- `GET /api/v1/students/` (parents only see their children)

Classes:
- `GET /api/v1/classrooms/`
- `POST /api/v1/classrooms/:id/enroll/` (admin/teacher)
- `GET /api/v1/live-classes/`

Attendance:
- `GET /api/v1/attendance/?student=<id>`
- `POST /api/v1/attendance/` (teacher/admin)

Daily activity + media:
- `GET /api/v1/daily-reports/?student=<id>`
- `POST /api/v1/daily-reports/` (teacher/admin)
- `POST /api/v1/daily-reports/:id/upload-media/` (multipart file) (teacher/admin)

Notifications:
- `GET /api/v1/announcements/`
- `POST /api/v1/announcements/` (teacher/admin)

## Admin Routine Management (Main Feature)

- UI: `http://localhost:5173/admin/dashboard` (template-like dashboard)
- Timetable CRUD: `http://localhost:5173/admin/routines` (login as `admin`)
- API:
  - `GET /api/v1/routines/?classroom=<id>`
  - `POST /api/v1/routines/` (admin only)
  - `PATCH /api/v1/routines/:id/` (admin only)
  - `DELETE /api/v1/routines/:id/` (admin only)

## Production notes (best practices)

- Use `kms.settings.prod` by setting an env var before running:

```cmd
set DJANGO_SETTINGS_MODULE=kms.settings.prod
python manage.py runserver
```

- In production, set:
  - `DJANGO_SECRET_KEY`
  - `DJANGO_ALLOWED_HOSTS`
  - `CORS_ALLOWED_ORIGINS` (or serve React from same domain)
