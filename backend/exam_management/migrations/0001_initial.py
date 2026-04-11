# Generated manually for exam_management
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("academics", "0014_subject_marks_scheme"),
        ("students", "0003_student_class_login"),
        ("users", "0003_portalrole_user_portal_role_portalrolepermission"),
    ]

    operations = [
        migrations.CreateModel(
            name="Exam",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("exam_name", models.CharField(max_length=200)),
                ("section", models.CharField(blank=True, default="", max_length=1)),
                (
                    "exam_type",
                    models.CharField(
                        choices=[("CLASS_TEST", "Class Test"), ("MIDTERM", "Midterm"), ("FINAL", "Final"), ("MODEL_TEST", "Model Test")],
                        default="FINAL",
                        max_length=20,
                    ),
                ),
                ("start_date", models.DateField()),
                ("end_date", models.DateField()),
                (
                    "status",
                    models.CharField(
                        choices=[("DRAFT", "Draft"), ("OPEN", "Open"), ("FINALIZED", "Finalized"), ("PUBLISHED", "Published")],
                        default="DRAFT",
                        max_length=20,
                    ),
                ),
                (
                    "class_name",
                    models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="exams", to="academics.schoolclass"),
                ),
            ],
            options={
                "ordering": ["-start_date", "-id"],
            },
        ),
        migrations.CreateModel(
            name="AuditLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "action_type",
                    models.CharField(
                        choices=[
                            ("CREATE", "Create"),
                            ("UPDATE", "Update"),
                            ("DELETE", "Delete"),
                            ("MARKS_BULK_UPLOAD", "Marks Bulk Upload"),
                            ("RESULT_GENERATE", "Result Generate"),
                            ("RESULT_PUBLISH", "Result Publish"),
                            ("PROMOTION_BULK", "Promotion Bulk"),
                        ],
                        max_length=40,
                    ),
                ),
                ("timestamp", models.DateTimeField(auto_now_add=True)),
                ("details", models.JSONField(blank=True, default=dict)),
                (
                    "user",
                    models.ForeignKey(
                        blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="audit_logs", to=settings.AUTH_USER_MODEL
                    ),
                ),
            ],
            options={"ordering": ["-timestamp", "-id"]},
        ),
        migrations.CreateModel(
            name="Result",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("total_marks", models.DecimalField(decimal_places=2, default="0.00", max_digits=8)),
                ("average_marks", models.DecimalField(decimal_places=2, default="0.00", max_digits=8)),
                ("gpa", models.DecimalField(decimal_places=2, default="0.00", max_digits=4)),
                ("final_grade", models.CharField(blank=True, default="", max_length=2)),
                ("rank", models.PositiveIntegerField(blank=True, null=True)),
                ("is_passed", models.BooleanField(default=False)),
                (
                    "published_status",
                    models.CharField(choices=[("DRAFT", "Draft"), ("GENERATED", "Generated"), ("PUBLISHED", "Published")], default="DRAFT", max_length=20),
                ),
                ("details", models.JSONField(blank=True, default=dict)),
                ("generated_at", models.DateTimeField(blank=True, null=True)),
                ("published_at", models.DateTimeField(blank=True, null=True)),
                ("exam", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="results", to="exam_management.exam")),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="results", to="students.student")),
            ],
            options={"ordering": ["exam_id", "rank", "-total_marks", "student_id"]},
        ),
        migrations.CreateModel(
            name="ResultPublishLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("published_at", models.DateTimeField(auto_now_add=True)),
                ("note", models.CharField(blank=True, default="", max_length=255)),
                ("exam", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="publish_logs", to="exam_management.exam")),
                ("published_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="result_publish_logs", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-published_at", "-id"]},
        ),
        migrations.CreateModel(
            name="StudentExamMark",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("marks_obtained", models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True)),
                ("grade", models.CharField(blank=True, default="", max_length=2)),
                ("remarks", models.CharField(blank=True, default="", max_length=255)),
                ("exam", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="marks", to="exam_management.exam")),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="exam_marks", to="students.student")),
                ("subject", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="exam_marks", to="academics.subject")),
            ],
        ),
        migrations.CreateModel(
            name="Promotion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("from_section", models.CharField(blank=True, default="", max_length=1)),
                ("to_section", models.CharField(blank=True, default="", max_length=1)),
                ("promoted_at", models.DateTimeField(auto_now_add=True)),
                ("academic_year", models.CharField(max_length=20)),
                ("exam", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="promotions", to="exam_management.exam")),
                ("from_class", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="promotions_from", to="academics.schoolclass")),
                ("promoted_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="promotions_made", to=settings.AUTH_USER_MODEL)),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="promotions", to="students.student")),
                ("to_class", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="promotions_to", to="academics.schoolclass")),
            ],
            options={"ordering": ["-promoted_at", "-id"]},
        ),
        migrations.AddConstraint(
            model_name="exam",
            constraint=models.UniqueConstraint(fields=("exam_name", "class_name", "section"), name="uniq_exam_name_per_class_section"),
        ),
        migrations.AddIndex(
            model_name="exam",
            index=models.Index(fields=["class_name", "section", "start_date"], name="exam_manage_class_n_65e3ca_idx"),
        ),
        migrations.AddIndex(
            model_name="exam",
            index=models.Index(fields=["status", "start_date"], name="exam_manage_status__e06436_idx"),
        ),
        migrations.AddConstraint(
            model_name="studentexammark",
            constraint=models.UniqueConstraint(fields=("student", "exam", "subject"), name="uniq_student_exam_subject"),
        ),
        migrations.AddIndex(
            model_name="studentexammark",
            index=models.Index(fields=["exam", "student"], name="exam_manage_exam_id_9b2a93_idx"),
        ),
        migrations.AddIndex(
            model_name="studentexammark",
            index=models.Index(fields=["exam", "subject"], name="exam_manage_exam_id_6025b4_idx"),
        ),
        migrations.AddConstraint(
            model_name="result",
            constraint=models.UniqueConstraint(fields=("student", "exam"), name="uniq_result_student_exam"),
        ),
        migrations.AddIndex(
            model_name="result",
            index=models.Index(fields=["exam", "published_status"], name="exam_manage_exam_id_0a902d_idx"),
        ),
        migrations.AddIndex(
            model_name="result",
            index=models.Index(fields=["exam", "rank"], name="exam_manage_exam_id_5cd4cd_idx"),
        ),
        migrations.AddIndex(
            model_name="promotion",
            index=models.Index(fields=["academic_year", "from_class", "to_class"], name="exam_manage_academi_11f3b6_idx"),
        ),
        migrations.AddIndex(
            model_name="promotion",
            index=models.Index(fields=["student", "academic_year"], name="exam_manage_student__422d2a_idx"),
        ),
        migrations.AddIndex(
            model_name="resultpublishlog",
            index=models.Index(fields=["exam", "published_at"], name="exam_manage_exam_id_b5db44_idx"),
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["action_type", "timestamp"], name="exam_manage_action__c89bca_idx"),
        ),
    ]
