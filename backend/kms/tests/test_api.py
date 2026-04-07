from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from attendance.models import AttendanceRecord
from classes.models import Classroom, Enrollment, LiveClass
from notifications.models import Announcement
from reports.models import DailyActivityReport, ProgressNote
from students.models import ParentProfile, Student


User = get_user_model()


class ApiSmokeTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username="admin", password="admin1234", role="ADMIN", is_staff=True)
        self.teacher = User.objects.create_user(username="teacher", password="teacher1234", role="TEACHER")
        self.parent = User.objects.create_user(username="parent", password="parent1234", role="PARENT")
        ParentProfile.objects.create(user=self.parent)

        self.student = Student.objects.create(first_name="Mim", last_name="Rahman", parent=self.parent)
        self.classroom = Classroom.objects.create(name="Rainbow", teacher=self.teacher, year=timezone.now().year)
        Enrollment.objects.create(classroom=self.classroom, student=self.student)

        AttendanceRecord.objects.create(
            classroom=self.classroom,
            student=self.student,
            date=timezone.localdate(),
            status=AttendanceRecord.STATUS_PRESENT,
        )
        DailyActivityReport.objects.create(
            classroom=self.classroom,
            student=self.student,
            date=timezone.localdate(),
            mood=DailyActivityReport.MOOD_HAPPY,
            created_by=self.teacher,
            food="Rice",
            sleep="30 mins",
            learning="Colors",
        )
        ProgressNote.objects.create(
            student=self.student,
            classroom=self.classroom,
            title="Progress",
            note="Doing great",
            created_by=self.teacher,
        )
        LiveClass.objects.create(
            classroom=self.classroom,
            title="Circle time",
            starts_at=timezone.now() + timedelta(minutes=5),
            ends_at=timezone.now() + timedelta(minutes=50),
            meet_link="https://meet.google.com/",
            created_by=self.teacher,
        )
        Announcement.objects.create(
            title="Reminder",
            message="Bring a water bottle.",
            audience=Announcement.AUDIENCE_PARENTS,
            classroom=self.classroom,
            created_by=self.teacher,
        )

    def test_token_login(self):
        res = self.client.post("/api/v1/auth/token/", {"username": "parent", "password": "parent1234"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.data)

    def test_parent_dashboard_and_data_visibility(self):
        self.client.force_authenticate(self.parent)

        dash = self.client.get("/api/v1/dashboard/")
        self.assertEqual(dash.status_code, 200)
        self.assertEqual(dash.data["role"], "PARENT")

        students = self.client.get("/api/v1/students/")
        self.assertEqual(students.status_code, 200)
        self.assertEqual(len(students.data["results"]), 1)

        reports = self.client.get(f"/api/v1/daily-reports/?student={self.student.id}")
        self.assertEqual(reports.status_code, 200)
        self.assertGreaterEqual(len(reports.data["results"]), 1)

        attendance = self.client.get(f"/api/v1/attendance/?student={self.student.id}")
        self.assertEqual(attendance.status_code, 200)
        self.assertGreaterEqual(len(attendance.data["results"]), 1)

        announcements = self.client.get("/api/v1/announcements/")
        self.assertEqual(announcements.status_code, 200)
        self.assertGreaterEqual(len(announcements.data["results"]), 1)

    def test_teacher_cannot_create_attendance_for_other_teacher_classroom(self):
        other_teacher = User.objects.create_user(username="teacher2", password="x", role="TEACHER")
        other_classroom = Classroom.objects.create(name="Stars", teacher=other_teacher, year=timezone.now().year)
        Enrollment.objects.create(classroom=other_classroom, student=self.student)

        self.client.force_authenticate(self.teacher)
        res = self.client.post(
            "/api/v1/attendance/",
            {
                "classroom": other_classroom.id,
                "student": self.student.id,
                "date": str(timezone.localdate()),
                "status": AttendanceRecord.STATUS_PRESENT,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_department_crud_admin_only_write(self):
        res = self.client.post("/api/v1/auth/token/", {"username": "admin", "password": "admin1234"}, format="json")
        self.assertEqual(res.status_code, 200)
        access = res.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        created = self.client.post(
            "/api/v1/departments/",
            {"name": "Academics", "head": "Admin", "phone": "0123", "email": "admin@example.com", "employees": 3},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["name"], "Academics")

        listing = self.client.get("/api/v1/departments/")
        self.assertEqual(listing.status_code, 200)
        self.assertGreaterEqual(len(listing.data["results"]), 1)

    def test_academic_class_crud_admin_only_write(self):
        res = self.client.post("/api/v1/auth/token/", {"username": "admin", "password": "admin1234"}, format="json")
        self.assertEqual(res.status_code, 200)
        access = res.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        created = self.client.post(
            "/api/v1/academic-classes/",
            {"name": "Nursery", "sections": ["A", "B", "c"]},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["name"], "Nursery")
        self.assertEqual(created.data["sections"], ["A", "B", "C"])

        listing = self.client.get("/api/v1/academic-classes/")
        self.assertEqual(listing.status_code, 200)
        self.assertGreaterEqual(len(listing.data["results"]), 1)

    def test_academic_class_delete_blocked_when_subjects_exist(self):
        res = self.client.post("/api/v1/auth/token/", {"username": "admin", "password": "admin1234"}, format="json")
        self.assertEqual(res.status_code, 200)
        access = res.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        school_class = self.client.post(
            "/api/v1/academic-classes/",
            {"name": "Class 9", "sections": ["A"]},
            format="json",
        )
        self.assertEqual(school_class.status_code, 201)

        teacher = self.client.post(
            "/api/v1/subject-teachers/",
            {"name": "Mr. Karim", "phone": "01900000000"},
            format="json",
        )
        self.assertEqual(teacher.status_code, 201)

        subject = self.client.post(
            "/api/v1/subjects/",
            {
                "classroom": f"{school_class.data['id']}:A",
                "subject_teacher": teacher.data["id"],
                "name": "Science",
                "code": "SCI-101",
                "subject_type": "THEORY",
            },
            format="json",
        )
        self.assertEqual(subject.status_code, 201)

        deleted = self.client.delete(f"/api/v1/academic-classes/{school_class.data['id']}/")
        self.assertEqual(deleted.status_code, 400)
        self.assertIn("detail", deleted.data)

    def test_section_crud_admin_only_write(self):
        res = self.client.post("/api/v1/auth/token/", {"username": "admin", "password": "admin1234"}, format="json")
        self.assertEqual(res.status_code, 200)
        access = res.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        created = self.client.post(
            "/api/v1/sections/",
            {"name": "Section A"},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["name"], "Section A")

        listing = self.client.get("/api/v1/sections/")
        self.assertEqual(listing.status_code, 200)
        self.assertGreaterEqual(len(listing.data["results"]), 1)

    def test_subject_crud_admin_only_write(self):
        res = self.client.post("/api/v1/auth/token/", {"username": "admin", "password": "admin1234"}, format="json")
        self.assertEqual(res.status_code, 200)
        access = res.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        school_class = self.client.post(
            "/api/v1/academic-classes/",
            {"name": "Class 1", "sections": ["A", "B"]},
            format="json",
        )
        self.assertEqual(school_class.status_code, 201)

        teacher = self.client.post(
            "/api/v1/subject-teachers/",
            {"name": "Mr. Rahim", "phone": "01700000000"},
            format="json",
        )
        self.assertEqual(teacher.status_code, 201)

        created = self.client.post(
            "/api/v1/subjects/",
            {
                "classroom": f"{school_class.data['id']}:A",
                "subject_teacher": teacher.data["id"],
                "name": "English",
                "code": "ENG-101",
                "subject_type": "THEORY",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["code"], "ENG-101")

        listing = self.client.get("/api/v1/subjects/")
        self.assertEqual(listing.status_code, 200)
        self.assertGreaterEqual(len(listing.data["results"]), 1)

    def test_subject_list_can_filter_by_class_and_section(self):
        res = self.client.post("/api/v1/auth/token/", {"username": "admin", "password": "admin1234"}, format="json")
        self.assertEqual(res.status_code, 200)
        access = res.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        t = self.client.post("/api/v1/subject-teachers/", {"name": "Ms. Rupa"}, format="json")
        self.assertEqual(t.status_code, 201)

        c1 = self.client.post("/api/v1/academic-classes/", {"name": "FilterClass1", "sections": ["A"]}, format="json")
        self.assertEqual(c1.status_code, 201)
        c2 = self.client.post("/api/v1/academic-classes/", {"name": "FilterClass2", "sections": ["A"]}, format="json")
        self.assertEqual(c2.status_code, 201)

        s1 = self.client.post(
            "/api/v1/subjects/",
            {"classroom": f"{c1.data['id']}:A", "subject_teacher": t.data["id"], "name": "English X", "code": "ENG-X", "subject_type": "THEORY"},
            format="json",
        )
        self.assertEqual(s1.status_code, 201)

        s2 = self.client.post(
            "/api/v1/subjects/",
            {"classroom": f"{c2.data['id']}:A", "subject_teacher": t.data["id"], "name": "English Y", "code": "ENG-Y", "subject_type": "THEORY"},
            format="json",
        )
        self.assertEqual(s2.status_code, 201)

        filtered = self.client.get(f"/api/v1/subjects/?class={c1.data['id']}&section=A")
        self.assertEqual(filtered.status_code, 200)
        codes = [row["code"] for row in filtered.data["results"]]
        self.assertIn("ENG-X", codes)
        self.assertNotIn("ENG-Y", codes)

    def test_designation_crud_admin_only_write(self):
        res = self.client.post("/api/v1/auth/token/", {"username": "admin", "password": "admin1234"}, format="json")
        self.assertEqual(res.status_code, 200)
        access = res.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        created = self.client.post(
            "/api/v1/designations/",
            {"title": "Senior Teacher"},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["title"], "Senior Teacher")

    def test_subject_teacher_crud_admin_only_write(self):
        res = self.client.post("/api/v1/auth/token/", {"username": "admin", "password": "admin1234"}, format="json")
        self.assertEqual(res.status_code, 200)
        access = res.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        created = self.client.post(
            "/api/v1/subject-teachers/",
            {"name": "Mr. Rahim", "phone": "01700000000"},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertIn("teacher_code", created.data)
        self.assertEqual(len(created.data["teacher_code"]), 4)

        listing = self.client.get("/api/v1/subject-teachers/")
        self.assertEqual(listing.status_code, 200)
        self.assertGreaterEqual(len(listing.data["results"]), 1)

    def test_academic_routine_crud_admin_only_write(self):
        res = self.client.post("/api/v1/auth/token/", {"username": "admin", "password": "admin1234"}, format="json")
        self.assertEqual(res.status_code, 200)
        access = res.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        school_class = self.client.post(
            "/api/v1/academic-classes/",
            {"name": "Class 2", "sections": ["A", "B"]},
            format="json",
        )
        self.assertEqual(school_class.status_code, 201)

        teacher = self.client.post(
            "/api/v1/subject-teachers/",
            {"name": "Ms. Nila", "phone": "01800000000"},
            format="json",
        )
        self.assertEqual(teacher.status_code, 201)

        subject = self.client.post(
            "/api/v1/subjects/",
            {
                "classroom": f"{school_class.data['id']}:A",
                "subject_teacher": teacher.data["id"],
                "name": "Math",
                "code": "MTH-101",
                "subject_type": "THEORY",
            },
            format="json",
        )
        self.assertEqual(subject.status_code, 201)

        created = self.client.post(
            "/api/v1/academic-routines/",
            {
                "school_class": school_class.data["id"],
                "section": "A",
                "subject": subject.data["id"],
                "day_of_week": 1,
                "start_time": "09:00",
                "end_time": "10:00",
                "room": "101",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["section"], "A")
        self.assertEqual(created.data["subject"], subject.data["id"])
        # subject_teacher auto-selected from subject unless overridden
        self.assertTrue(created.data.get("subject_teacher"))

        listing = self.client.get(
            f"/api/v1/academic-routines/?class={school_class.data['id']}&section=A",
        )
        self.assertEqual(listing.status_code, 200)
        self.assertGreaterEqual(len(listing.data["results"]), 1)

        break_created = self.client.post(
            "/api/v1/academic-routines/",
            {
                "school_class": school_class.data["id"],
                "section": "A",
                "routine_type": "BREAK",
                "title": "Tiffin",
                "day_of_week": 1,
                "start_time": "10:00",
                "end_time": "10:15",
            },
            format="json",
        )
        self.assertEqual(break_created.status_code, 201)
        self.assertEqual(break_created.data["routine_type"], "BREAK")

        updated_meet = self.client.post(
            f"/api/v1/academic-routines/{created.data['id']}/update-meet/",
            {"day_of_week": 2, "start_time": "08:30", "end_time": "09:15"},
            format="json",
        )
        self.assertEqual(updated_meet.status_code, 200)
        self.assertEqual(updated_meet.data["day_of_week"], 2)

    def test_classroom_create_admin(self):
        res = self.client.post("/api/v1/auth/token/", {"username": "admin", "password": "admin1234"}, format="json")
        self.assertEqual(res.status_code, 200)
        access = res.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        created = self.client.post(
            "/api/v1/rooms/",
            {"room_no": "101", "capacity": 30},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["room_no"], "101")
