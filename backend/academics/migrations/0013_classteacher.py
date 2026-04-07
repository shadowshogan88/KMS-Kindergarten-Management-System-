from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("academics", "0012_subjectteacher_email"),
    ]

    operations = [
        migrations.CreateModel(
            name="ClassTeacher",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("section", models.CharField(blank=True, default="", max_length=1)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "school_class",
                    models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="class_teachers", to="academics.schoolclass"),
                ),
                (
                    "teacher",
                    models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="class_assignments", to="academics.subjectteacher"),
                ),
            ],
            options={
                "ordering": ["school_class_id", "section", "id"],
            },
        ),
        migrations.AddConstraint(
            model_name="classteacher",
            constraint=models.UniqueConstraint(fields=("school_class", "section"), name="uniq_class_teacher_class_section"),
        ),
    ]

