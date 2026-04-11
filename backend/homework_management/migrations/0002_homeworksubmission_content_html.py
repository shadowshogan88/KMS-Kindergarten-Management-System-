from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("homework_management", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="homeworksubmission",
            name="content_html",
            field=models.TextField(blank=True, default=""),
        ),
    ]

