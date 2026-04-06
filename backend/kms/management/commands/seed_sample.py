from datetime import date, datetime, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from attendance.models import AttendanceRecord
from classes.models import Classroom, Enrollment, LiveClass
from notifications.models import Announcement
from reports.models import DailyActivityReport, ProgressNote
from students.models import ParentProfile, Student
from routines.models import ClassRoutine


User = get_user_model()


class Command(BaseCommand):
    help = "Create sample users, students, classrooms, attendance, reports, announcements."

    def handle(self, *args, **options):
        def ensure_password(user, raw_password):
            if not user.password or user.password.startswith("!") or "$" not in user.password:
                user.set_password(raw_password)
                user.save(update_fields=["password"])

        admin, _ = User.objects.get_or_create(
            username="admin",
            defaults={"role": "ADMIN", "email": "admin@example.com", "is_staff": True, "is_superuser": True},
        )
        ensure_password(admin, "admin1234")

        teacher, _ = User.objects.get_or_create(
            username="teacher",
            defaults={"role": "TEACHER", "email": "teacher@example.com", "first_name": "Ms", "last_name": "Amina"},
        )
        ensure_password(teacher, "teacher1234")

        parent, _ = User.objects.get_or_create(
            username="parent",
            defaults={"role": "PARENT", "email": "parent@example.com", "first_name": "Mr", "last_name": "Rahman"},
        )
        ensure_password(parent, "parent1234")

        ParentProfile.objects.get_or_create(
            user=parent,
            defaults={
                "address": "Dhaka, Bangladesh",
                "emergency_contact_name": "Aunt Rina",
                "emergency_contact_phone": "+8801XXXXXXXXX",
            },
        )

        student1, _ = Student.objects.get_or_create(
            first_name="Mim",
            last_name="Rahman",
            parent=parent,
            defaults={"medical_info": "No allergies reported.", "pickup_authorized_people": "Aunt Rina"},
        )
        student2, _ = Student.objects.get_or_create(
            first_name="Rafi",
            last_name="Rahman",
            parent=parent,
            defaults={"medical_info": "Peanut allergy.", "pickup_authorized_people": "Uncle Karim"},
        )

        classroom, _ = Classroom.objects.get_or_create(
            name="Rainbow Class",
            year=timezone.now().year,
            defaults={"teacher": teacher},
        )
        if classroom.teacher_id != teacher.id:
            classroom.teacher = teacher
            classroom.save(update_fields=["teacher"])

        Enrollment.objects.get_or_create(classroom=classroom, student=student1)
        Enrollment.objects.get_or_create(classroom=classroom, student=student2)

        # Class routines (Sat–Thu only)
        ClassRoutine.objects.get_or_create(
            classroom=classroom,
            teacher=teacher,
            day_of_week=ClassRoutine.DAY_SAT,
            start_time="09:00",
            end_time="09:40",
            defaults={"title": "Morning Circle", "room": "Room A"},
        )
        ClassRoutine.objects.get_or_create(
            classroom=classroom,
            teacher=teacher,
            day_of_week=ClassRoutine.DAY_SAT,
            start_time="10:00",
            end_time="10:40",
            defaults={"title": "Drawing", "room": "Art Corner"},
        )
        ClassRoutine.objects.get_or_create(
            classroom=classroom,
            teacher=teacher,
            day_of_week=ClassRoutine.DAY_SUN,
            start_time="09:00",
            end_time="09:40",
            defaults={"title": "Reading", "room": "Library"},
        )

        # Live class (Google Meet link stored)
        starts = timezone.now() + timedelta(minutes=15)
        ends = starts + timedelta(minutes=45)
        LiveClass.objects.get_or_create(
            classroom=classroom,
            title="Morning Circle Time",
            starts_at=starts,
            ends_at=ends,
            defaults={"meet_link": "https://meet.google.com/", "created_by": teacher},
        )

        # Attendance + daily report for today
        today = timezone.localdate()
        AttendanceRecord.objects.get_or_create(
            classroom=classroom,
            student=student1,
            date=today,
            defaults={"status": AttendanceRecord.STATUS_PRESENT, "note": "Arrived on time"},
        )
        AttendanceRecord.objects.get_or_create(
            classroom=classroom,
            student=student2,
            date=today,
            defaults={"status": AttendanceRecord.STATUS_LATE, "note": "Arrived 10 minutes late"},
        )

        DailyActivityReport.objects.get_or_create(
            classroom=classroom,
            student=student1,
            date=today,
            defaults={
                "food": "Ate rice and eggs.",
                "sleep": "Napped 45 minutes.",
                "mood": DailyActivityReport.MOOD_HAPPY,
                "learning": "Colors and counting 1-10.",
                "teacher_notes": "Great participation!",
                "created_by": teacher,
            },
        )

        DailyActivityReport.objects.get_or_create(
            classroom=classroom,
            student=student2,
            date=today,
            defaults={
                "food": "Ate fruits, skipped lunch.",
                "sleep": "Napped 30 minutes.",
                "mood": DailyActivityReport.MOOD_OKAY,
                "learning": "Story time and shapes.",
                "teacher_notes": "Needed some encouragement.",
                "created_by": teacher,
            },
        )

        ProgressNote.objects.get_or_create(
            student=student1,
            classroom=classroom,
            title="Counting Progress",
            defaults={"note": "Can count confidently up to 10.", "created_by": teacher},
        )

        Announcement.objects.get_or_create(
            title="Parents Meeting Reminder",
            defaults={
                "message": "Reminder: Parents meeting this Friday at 4:00 PM.",
                "audience": Announcement.AUDIENCE_PARENTS,
                "classroom": classroom,
                "created_by": teacher,
            },
        )

        self.stdout.write(self.style.SUCCESS("Sample data created."))
        self.stdout.write("Login users:")
        self.stdout.write("  admin / admin1234")
        self.stdout.write("  teacher / teacher1234")
        self.stdout.write("  parent / parent1234")
