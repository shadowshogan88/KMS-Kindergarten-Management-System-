from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("homework_management", "0004_homework_class_date_homework_special_live_class_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="homeworksubmission",
            name="teacher_total_marks",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True),
        ),
        migrations.AddField(
            model_name="homeworkgradelog",
            name="total_marks",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True),
        ),
    ]
