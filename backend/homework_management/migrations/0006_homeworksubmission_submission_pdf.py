from django.db import migrations, models
import homework_management.models


class Migration(migrations.Migration):

    dependencies = [
        ("homework_management", "0005_homeworksubmission_teacher_total_marks_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="homeworksubmission",
            name="submission_pdf",
            field=models.FileField(blank=True, null=True, upload_to=homework_management.models.submission_pdf_upload_to),
        ),
    ]

