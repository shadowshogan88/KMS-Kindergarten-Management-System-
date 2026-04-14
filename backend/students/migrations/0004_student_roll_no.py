from django.db import migrations, models
from django.db.models import Q


def backfill_roll_numbers(apps, schema_editor):
    Student = apps.get_model("students", "Student")
    rows = Student.objects.exclude(school_class_id__isnull=True).order_by("school_class_id", "section", "created_at", "id")
    counters = {}
    for row in rows.iterator():
        key = (row.school_class_id, (row.section or "").strip().upper())
        counters[key] = counters.get(key, 0) + 1
        Student.objects.filter(pk=row.pk).update(roll_no=counters[key])


class Migration(migrations.Migration):

    dependencies = [
        ("students", "0003_student_class_login"),
    ]

    operations = [
        migrations.AddField(
            model_name="student",
            name="roll_no",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_roll_numbers, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="student",
            constraint=models.UniqueConstraint(
                condition=Q(roll_no__isnull=False),
                fields=("school_class", "section", "roll_no"),
                name="uniq_student_roll_per_class_section",
            ),
        ),
        migrations.AddConstraint(
            model_name="student",
            constraint=models.CheckConstraint(
                condition=Q(roll_no__isnull=True) | Q(roll_no__gte=1),
                name="student_roll_positive_or_null",
            ),
        ),
    ]
