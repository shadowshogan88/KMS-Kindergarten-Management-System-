from datetime import date, time, timedelta
import os
import shutil

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from attendance.models import AttendanceRecord
from attendance.models import AcademicAttendanceRecord
from classes.models import Classroom, Enrollment, LiveClass
from notifications.models import Announcement
from reports.models import DailyActivityReport, ProgressNote
from students.models import ParentProfile, Student
from academics.models import ClassTeacher, SchoolClass, Subject, SubjectTeacher
from homework_management.models import Homework, HomeworkSubmission
from users.models import PortalRole
from users.models import PortalRolePermission
from routines.models import AcademicClassRoutine


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

    def test_profile_picture_upload_persists_in_me_response(self):
        self.client.force_authenticate(self.parent)
        gif_bytes = (
            b"GIF87a\x01\x00\x01\x00\x80\x01\x00\x00\x00\x00"
            b"\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00"
            b"\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
        )

        tmpdir = os.path.join(os.getcwd(), "test_media_profile_picture")
        os.makedirs(tmpdir, exist_ok=True)
        try:
            with override_settings(MEDIA_ROOT=tmpdir):
                upload = self.client.post(
                    "/api/v1/auth/profile-picture/",
                    {"profile_picture": SimpleUploadedFile("avatar.gif", gif_bytes, content_type="image/gif")},
                )
                self.assertEqual(upload.status_code, 200)
                self.assertIn("/media/users/profile_pictures/", upload.data.get("profile_picture_url", ""))

                me = self.client.get("/api/v1/auth/me/")
                self.assertEqual(me.status_code, 200)
                self.assertEqual(me.data.get("profile_picture_url"), upload.data.get("profile_picture_url"))

                removed = self.client.delete("/api/v1/auth/profile-picture/")
                self.assertEqual(removed.status_code, 200)
                self.assertEqual(removed.data.get("profile_picture_url"), "")
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

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

    def test_server_time_endpoint_returns_timezone_and_epoch(self):
        self.client.force_authenticate(self.parent)
        res = self.client.get("/api/v1/time/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("time_zone", res.data)
        self.assertIn("now", res.data)
        self.assertIn("epoch_ms", res.data)
        self.assertIn("offset_minutes", res.data)
        self.assertIsInstance(res.data["epoch_ms"], int)

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

    def test_student_can_auto_create_student_user(self):
        res = self.client.post("/api/v1/auth/token/", {"username": "admin", "password": "admin1234"}, format="json")
        self.assertEqual(res.status_code, 200)
        access = res.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        school_class = self.client.post(
            "/api/v1/academic-classes/",
            {"name": "Std-1", "sections": ["A"]},
            format="json",
        )
        self.assertEqual(school_class.status_code, 201)

        created = self.client.post(
            "/api/v1/students/",
            {
                "first_name": "Rafi",
                "last_name": "Hasan",
                "email": "rafi.student@example.com",
                "phone": "01900000000",
                "school_class": school_class.data["id"],
                "section": "A",
                "create_user": True,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertTrue(created.data.get("user"))
        username = created.data.get("generated_username") or ""
        password = created.data.get("generated_password") or ""
        self.assertTrue(username.startswith(f"sid{str(timezone.localdate().year)[-2:]}"))
        self.assertEqual(len(username), 10)  # sid + YY + 5 digits
        self.assertTrue(username[-5:].isdigit())
        self.assertTrue(password)

        login = self.client.post("/api/v1/auth/token/", {"username": username, "password": password}, format="json")
        self.assertEqual(login.status_code, 200)

        # First-login should suggest password change.
        access2 = login.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access2}")
        me = self.client.get("/api/v1/auth/me/")
        self.assertEqual(me.status_code, 200)
        self.assertTrue(me.data.get("must_change_password"))

        # Change password without current password.
        changed = self.client.post("/api/v1/auth/change-password/", {"new_password": "NewStrongPass123!"}, format="json")
        self.assertEqual(changed.status_code, 200)
        me2 = self.client.get("/api/v1/auth/me/")
        self.assertEqual(me2.status_code, 200)
        self.assertFalse(me2.data.get("must_change_password"))

        # Login works with new password.
        login2 = self.client.post("/api/v1/auth/token/", {"username": username, "password": "NewStrongPass123!"}, format="json")
        self.assertEqual(login2.status_code, 200)

    def test_academic_attendance_sheet_and_bulk(self):
        res = self.client.post("/api/v1/auth/token/", {"username": "admin", "password": "admin1234"}, format="json")
        self.assertEqual(res.status_code, 200)
        access = res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        school_class = self.client.post("/api/v1/academic-classes/", {"name": "AttClass", "sections": ["A"]}, format="json")
        self.assertEqual(school_class.status_code, 201)

        # Create a student in that class/section (no login needed for attendance).
        created_student = self.client.post(
            "/api/v1/students/",
            {"first_name": "S1", "email": "s1@example.com", "school_class": school_class.data["id"], "section": "A"},
            format="json",
        )
        self.assertEqual(created_student.status_code, 201)

        sheet = self.client.get(f"/api/v1/academic-attendance/sheet/?class={school_class.data['id']}&section=A&date={timezone.localdate()}")
        self.assertEqual(sheet.status_code, 200)
        self.assertEqual(sheet.data["school_class"], school_class.data["id"])
        self.assertEqual(sheet.data["section"], "A")
        self.assertEqual(len(sheet.data["students"]), 1)
        self.assertEqual(sheet.data["students"][0]["status"], "")

        bulk = self.client.post(
            "/api/v1/academic-attendance/bulk/",
            {
                "class": school_class.data["id"],
                "section": "A",
                "date": str(timezone.localdate()),
                "items": [{"student": created_student.data["id"], "status": "PRESENT"}],
            },
            format="json",
        )
        self.assertEqual(bulk.status_code, 200)

    def test_student_academic_attendance_month_grid_is_scoped(self):
        class1 = SchoolClass.objects.create(name="C1", sections=["A"])
        class2 = SchoolClass.objects.create(name="C2", sections=["A"])

        student_user = User.objects.create_user(username="stu1", password="x", role="STUDENT")
        # Simulate a real portal setup where a student has an active portal role but no explicit permissions.
        # Student should still be able to fetch their own scoped class options.
        student_role = PortalRole.objects.create(name="students", is_active=True)
        student_user.portal_role = student_role
        student_user.save(update_fields=["portal_role"])
        s1 = Student.objects.create(first_name="S1", user=student_user, school_class=class1, section="A")
        s2 = Student.objects.create(first_name="S2", school_class=class2, section="A")

        AcademicAttendanceRecord.objects.create(
            school_class=class1,
            section="A",
            student=s1,
            date=date(2026, 4, 2),
            status=AcademicAttendanceRecord.STATUS_PRESENT,
        )
        AcademicAttendanceRecord.objects.create(
            school_class=class2,
            section="A",
            student=s2,
            date=date(2026, 4, 2),
            status=AcademicAttendanceRecord.STATUS_ABSENT,
        )

        self.client.force_authenticate(student_user)

        # Even if a student tries to query a different class, response should be scoped to their own profile.
        res = self.client.get(f"/api/v1/academic-attendance/month-grid/?class={class2.id}&section=A&month=2026-04")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["class"], class1.id)
        self.assertEqual(res.data["section"], "A")
        self.assertEqual(len(res.data["students"]), 1)
        self.assertEqual(res.data["students"][0]["id"], s1.id)

        opt = self.client.get("/api/v1/academic-classes/options/")
        self.assertEqual(opt.status_code, 200)
        self.assertEqual(len(opt.data), 1)
        self.assertEqual(opt.data[0]["value"], f"{class1.id}:A")

    def test_student_academic_routines_list_is_scoped(self):
        class1 = SchoolClass.objects.create(name="R1", sections=["A"])
        class2 = SchoolClass.objects.create(name="R2", sections=["A"])

        student_user = User.objects.create_user(username="stu2", password="x", role="STUDENT")
        role = PortalRole.objects.create(name="students_routine", is_active=True)
        PortalRolePermission.objects.create(role=role, path="/portal/class-routine", can_view=True)
        student_user.portal_role = role
        student_user.save(update_fields=["portal_role"])

        Student.objects.create(first_name="S1", user=student_user, school_class=class1, section="A")

        AcademicClassRoutine.objects.create(
            school_class=class1,
            section="A",
            routine_type=AcademicClassRoutine.TYPE_BREAK,
            title="Tiffin",
            day_of_week=0,
            start_time=time(9, 0),
            end_time=time(9, 15),
        )
        AcademicClassRoutine.objects.create(
            school_class=class2,
            section="A",
            routine_type=AcademicClassRoutine.TYPE_BREAK,
            title="Tiffin",
            day_of_week=0,
            start_time=time(10, 0),
            end_time=time(10, 15),
        )

        self.client.force_authenticate(student_user)
        res = self.client.get(f"/api/v1/academic-routines/?class={class2.id}&section=A")
        self.assertEqual(res.status_code, 200)
        results = res.data.get("results") if isinstance(res.data, dict) else res.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["school_class"], class1.id)
        self.assertEqual(results[0]["section"], "A")

    def test_student_live_calendar_is_scoped(self):
        class1 = SchoolClass.objects.create(name="LC1", sections=["A"])
        class2 = SchoolClass.objects.create(name="LC2", sections=["A"])

        student_user = User.objects.create_user(username="stu3", password="x", role="STUDENT")
        Student.objects.create(first_name="S1", user=student_user, school_class=class1, section="A")

        rt1 = AcademicClassRoutine.objects.create(
            school_class=class1,
            section="A",
            routine_type=AcademicClassRoutine.TYPE_BREAK,
            title="Tiffin",
            day_of_week=0,
            start_time=time(9, 0),
            end_time=time(9, 15),
        )
        rt2 = AcademicClassRoutine.objects.create(
            school_class=class2,
            section="A",
            routine_type=AcademicClassRoutine.TYPE_BREAK,
            title="Tiffin",
            day_of_week=0,
            start_time=time(10, 0),
            end_time=time(10, 15),
        )

        # Pick a Saturday for day_of_week=0 routines.
        d = date(2026, 4, 1)
        while d.weekday() != 5:
            d = d + timedelta(days=1)

        self.client.force_authenticate(student_user)
        res = self.client.get(f"/api/v1/live-calendar/?class={class2.id}&section=A&start={d}&end={d}")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(any(ev.get("routine_id") == rt1.id for ev in res.data))
        self.assertFalse(any(ev.get("routine_id") == rt2.id for ev in res.data))

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
        self.assertFalse(created.data.get("generated_username"))
        self.assertFalse(created.data.get("generated_password"))

        listing = self.client.get("/api/v1/subject-teachers/")
        self.assertEqual(listing.status_code, 200)
        self.assertGreaterEqual(len(listing.data["results"]), 1)

    def test_subject_teacher_can_auto_create_teacher_user(self):
        res = self.client.post("/api/v1/auth/token/", {"username": "admin", "password": "admin1234"}, format="json")
        self.assertEqual(res.status_code, 200)
        access = res.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        created = self.client.post(
            "/api/v1/subject-teachers/",
            {"name": "Ms. Asha", "phone": "01800000011", "create_user": True, "email": "asha@example.com"},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertTrue(created.data.get("user"))
        self.assertTrue(created.data.get("generated_username"))
        self.assertTrue(created.data.get("generated_password"))

        username = created.data["generated_username"]
        password = created.data["generated_password"]

        login = self.client.post("/api/v1/auth/token/", {"username": username, "password": password}, format="json")
        self.assertEqual(login.status_code, 200)

    def test_subject_teacher_create_user_requires_email(self):
        res = self.client.post("/api/v1/auth/token/", {"username": "admin", "password": "admin1234"}, format="json")
        self.assertEqual(res.status_code, 200)
        access = res.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        created = self.client.post(
            "/api/v1/subject-teachers/",
            {"name": "NoEmail Teacher", "create_user": True},
            format="json",
        )
        self.assertEqual(created.status_code, 400)

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

    def test_student_homework_list_hides_drafts(self):
        school_class = SchoolClass.objects.create(name="HW Class", sections=["A"])
        teacher_user = User.objects.create_user(username="hwteacher", password="x", role="TEACHER")
        teacher_profile = SubjectTeacher.objects.create(user=teacher_user)
        ClassTeacher.objects.create(school_class=school_class, section="A", teacher=teacher_profile)
        subject = Subject.objects.create(name="Homework Subject", code="HW-SUB-1", school_class=school_class, section="A")

        student_user = User.objects.create_user(username="hwstudent", password="x", role="STUDENT")
        student_role = PortalRole.objects.create(name="students_homework", is_active=True)
        PortalRolePermission.objects.create(role=student_role, path="/portal/homework", can_view=True)
        student_user.portal_role = student_role
        student_user.save(update_fields=["portal_role"])
        Student.objects.create(first_name="Student", user=student_user, school_class=school_class, section="A")

        Homework.objects.create(
            title="Draft HW",
            class_name=school_class,
            section="A",
            subject=subject,
            created_by=teacher_user,
            due_date=timezone.now() + timedelta(days=1),
            status=Homework.STATUS_DRAFT,
        )
        published = Homework.objects.create(
            title="Published HW",
            class_name=school_class,
            section="A",
            subject=subject,
            created_by=teacher_user,
            due_date=timezone.now() + timedelta(days=2),
            status=Homework.STATUS_PUBLISHED,
        )

        self.client.force_authenticate(student_user)
        res = self.client.get("/api/v1/homeworks/?type=HOMEWORK")
        self.assertEqual(res.status_code, 200)
        results = res.data.get("results") if isinstance(res.data, dict) else res.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], published.id)

    def test_student_cannot_create_submission_for_draft_homework(self):
        school_class = SchoolClass.objects.create(name="HW Submit Class", sections=["A"])
        teacher_user = User.objects.create_user(username="hwteacher2", password="x", role="TEACHER")
        subject = Subject.objects.create(name="Homework Subject 2", code="HW-SUB-2", school_class=school_class, section="A")

        student_user = User.objects.create_user(username="hwstudent2", password="x", role="STUDENT")
        student_role = PortalRole.objects.create(name="students_homework_submit", is_active=True)
        PortalRolePermission.objects.create(role=student_role, path="/portal/homework/submissions", can_view=True, can_edit=True)
        student_user.portal_role = student_role
        student_user.save(update_fields=["portal_role"])
        student = Student.objects.create(first_name="Student", user=student_user, school_class=school_class, section="A")

        draft_homework = Homework.objects.create(
            title="Draft Only",
            class_name=school_class,
            section="A",
            subject=subject,
            created_by=teacher_user,
            due_date=timezone.now() + timedelta(days=1),
            status=Homework.STATUS_DRAFT,
        )

        self.client.force_authenticate(student_user)
        res = self.client.post(
            "/api/v1/submissions/",
            {"homework": draft_homework.id, "student": student.id, "content_html": "<p>Answer</p>"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("homework", res.data)

        submission = HomeworkSubmission.objects.create(homework=draft_homework, student=student)
        res_submit = self.client.post(f"/api/v1/submissions/{submission.id}/submit/", {}, format="json")
        self.assertEqual(res_submit.status_code, 400)
        self.assertIn("homework", res_submit.data)

    def test_student_can_create_submission_without_student_field(self):
        school_class = SchoolClass.objects.create(name="HW Submit Class 2", sections=["A"])
        teacher_user = User.objects.create_user(username="hwteacher3", password="x", role="TEACHER")
        subject = Subject.objects.create(name="Homework Subject 3", code="HW-SUB-3", school_class=school_class, section="A")

        student_user = User.objects.create_user(username="hwstudent3", password="x", role="STUDENT")
        student_role = PortalRole.objects.create(name="students_homework_submit_ok", is_active=True)
        PortalRolePermission.objects.create(role=student_role, path="/portal/homework/submissions", can_view=True, can_edit=True)
        student_user.portal_role = student_role
        student_user.save(update_fields=["portal_role"])
        student = Student.objects.create(first_name="Student", user=student_user, school_class=school_class, section="A")

        published_homework = Homework.objects.create(
            title="Published Only",
            class_name=school_class,
            section="A",
            subject=subject,
            created_by=teacher_user,
            due_date=timezone.now() + timedelta(days=1),
            status=Homework.STATUS_PUBLISHED,
        )

        self.client.force_authenticate(student_user)
        res = self.client.post(
            "/api/v1/submissions/",
            {"homework": published_homework.id, "content_html": "<p>Answer</p>"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["student"], student.id)
        self.assertEqual(res.data["homework"], published_homework.id)

    def test_submission_images_auto_increment_and_page_reorder(self):
        school_class = SchoolClass.objects.create(name="HW Image Class", sections=["A"])
        teacher_user = User.objects.create_user(username="hwteacher4", password="x", role="TEACHER")
        subject = Subject.objects.create(name="Homework Subject 4", code="HW-SUB-4", school_class=school_class, section="A")

        student_user = User.objects.create_user(username="hwstudent4", password="x", role="STUDENT")
        student_role = PortalRole.objects.create(name="students_homework_images", is_active=True)
        PortalRolePermission.objects.create(role=student_role, path="/portal/homework/submissions", can_view=True, can_edit=True)
        student_user.portal_role = student_role
        student_user.save(update_fields=["portal_role"])
        student = Student.objects.create(first_name="Student", user=student_user, school_class=school_class, section="A")

        published_homework = Homework.objects.create(
            title="Published Images",
            class_name=school_class,
            section="A",
            subject=subject,
            created_by=teacher_user,
            due_date=timezone.now() + timedelta(days=1),
            status=Homework.STATUS_PUBLISHED,
        )
        submission = HomeworkSubmission.objects.create(homework=published_homework, student=student)

        gif_bytes = (
            b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!"
            b"\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00"
            b"\x00\x02\x02D\x01\x00;"
        )

        self.client.force_authenticate(student_user)
        img1 = self.client.post(
            "/api/v1/submission-images/",
            {"submission": submission.id, "image": SimpleUploadedFile("page1.gif", gif_bytes, content_type="image/gif")},
        )
        self.assertEqual(img1.status_code, 201)
        self.assertEqual(img1.data["page_number"], 1)

        img2 = self.client.post(
            "/api/v1/submission-images/",
            {"submission": submission.id, "image": SimpleUploadedFile("page2.gif", gif_bytes, content_type="image/gif")},
        )
        self.assertEqual(img2.status_code, 201)
        self.assertEqual(img2.data["page_number"], 2)

        moved = self.client.patch(
            f"/api/v1/submission-images/{img2.data['id']}/",
            {"page_number": 1},
            format="json",
        )
        self.assertEqual(moved.status_code, 200)

        listing = self.client.get(f"/api/v1/submission-images/?submission={submission.id}")
        self.assertEqual(listing.status_code, 200)
        rows = listing.data.get("results") if isinstance(listing.data, dict) else listing.data
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["id"], img2.data["id"])
        self.assertEqual(rows[0]["page_number"], 1)
        self.assertEqual(rows[1]["page_number"], 2)

    def test_student_can_modify_submitted_submission_before_due_until_graded(self):
        school_class = SchoolClass.objects.create(name="HW Edit Window", sections=["A"])
        teacher_user = User.objects.create_user(username="hwteacher5", password="x", role="TEACHER")
        subject = Subject.objects.create(name="Homework Subject 5", code="HW-SUB-5", school_class=school_class, section="A")

        student_user = User.objects.create_user(username="hwstudent5", password="x", role="STUDENT")
        student_role = PortalRole.objects.create(name="students_homework_edit_window", is_active=True)
        PortalRolePermission.objects.create(role=student_role, path="/portal/homework/submissions", can_view=True, can_edit=True)
        student_user.portal_role = student_role
        student_user.save(update_fields=["portal_role"])
        student = Student.objects.create(first_name="Student", user=student_user, school_class=school_class, section="A")

        published_homework = Homework.objects.create(
            title="Submitted Editable",
            class_name=school_class,
            section="A",
            subject=subject,
            created_by=teacher_user,
            due_date=timezone.now() + timedelta(days=1),
            status=Homework.STATUS_PUBLISHED,
        )
        submission = HomeworkSubmission.objects.create(
            homework=published_homework,
            student=student,
            status=HomeworkSubmission.STATUS_SUBMITTED,
            submitted_at=timezone.now(),
        )

        gif_bytes = (
            b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!"
            b"\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00"
            b"\x00\x02\x02D\x01\x00;"
        )

        self.client.force_authenticate(student_user)
        img = self.client.post(
            "/api/v1/submission-images/",
            {"submission": submission.id, "image": SimpleUploadedFile("page1.gif", gif_bytes, content_type="image/gif")},
        )
        self.assertEqual(img.status_code, 201)

        deleted = self.client.delete(f"/api/v1/submission-images/{img.data['id']}/")
        self.assertEqual(deleted.status_code, 204)

        submission.teacher_marks = 88
        submission.teacher_feedback = "Good"
        submission.status = HomeworkSubmission.STATUS_GRADED
        submission.save(update_fields=["teacher_marks", "teacher_feedback", "status", "updated_at"])

        locked = self.client.post(
            "/api/v1/submission-images/",
            {"submission": submission.id, "image": SimpleUploadedFile("page2.gif", gif_bytes, content_type="image/gif")},
        )
        self.assertEqual(locked.status_code, 400)
        self.assertIn("submission", locked.data)

    def test_student_cannot_modify_submission_after_due_date(self):
        school_class = SchoolClass.objects.create(name="HW Due Lock", sections=["A"])
        teacher_user = User.objects.create_user(username="hwteacher6", password="x", role="TEACHER")
        subject = Subject.objects.create(name="Homework Subject 6", code="HW-SUB-6", school_class=school_class, section="A")

        student_user = User.objects.create_user(username="hwstudent6", password="x", role="STUDENT")
        student_role = PortalRole.objects.create(name="students_homework_due_lock", is_active=True)
        PortalRolePermission.objects.create(role=student_role, path="/portal/homework/submissions", can_view=True, can_edit=True)
        student_user.portal_role = student_role
        student_user.save(update_fields=["portal_role"])
        student = Student.objects.create(first_name="Student", user=student_user, school_class=school_class, section="A")

        published_homework = Homework.objects.create(
            title="Due Locked",
            class_name=school_class,
            section="A",
            subject=subject,
            created_by=teacher_user,
            due_date=timezone.now() - timedelta(minutes=5),
            allow_late_submission=True,
            status=Homework.STATUS_PUBLISHED,
        )
        submission = HomeworkSubmission.objects.create(
            homework=published_homework,
            student=student,
            status=HomeworkSubmission.STATUS_SUBMITTED,
            submitted_at=timezone.now() - timedelta(minutes=10),
        )

        gif_bytes = (
            b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!"
            b"\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00"
            b"\x00\x02\x02D\x01\x00;"
        )

        self.client.force_authenticate(student_user)
        locked = self.client.post(
            "/api/v1/submission-images/",
            {"submission": submission.id, "image": SimpleUploadedFile("late.gif", gif_bytes, content_type="image/gif")},
        )
        self.assertEqual(locked.status_code, 400)
        self.assertIn("submission", locked.data)

    def test_teacher_can_grade_submission_with_obtained_over_total_format(self):
        school_class = SchoolClass.objects.create(name="HW Grade Fraction", sections=["A"])
        teacher_user = User.objects.create_user(username="hwteacher7", password="x", role="TEACHER")
        admin_user = User.objects.create_user(username="hwadmin7", password="x", role="ADMIN", is_staff=True)
        subject = Subject.objects.create(name="Homework Subject 7", code="HW-SUB-7", school_class=school_class, section="A")

        student_user = User.objects.create_user(username="hwstudent7", password="x", role="STUDENT")
        student = Student.objects.create(first_name="Student", user=student_user, school_class=school_class, section="A")

        published_homework = Homework.objects.create(
            title="Fraction Grade",
            class_name=school_class,
            section="A",
            subject=subject,
            created_by=teacher_user,
            due_date=timezone.now() + timedelta(days=1),
            status=Homework.STATUS_PUBLISHED,
        )
        submission = HomeworkSubmission.objects.create(homework=published_homework, student=student)

        self.client.force_authenticate(admin_user)
        res = self.client.post(
            f"/api/v1/submissions/{submission.id}/grade/",
            {"marks": "80/100", "feedback": "Well done"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)

        submission.refresh_from_db()
        self.assertEqual(float(submission.teacher_marks), 80.0)
        self.assertEqual(float(submission.teacher_total_marks), 100.0)

        detail = self.client.get(f"/api/v1/submissions/{submission.id}/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["marks_display"], "80.00/100.00")
