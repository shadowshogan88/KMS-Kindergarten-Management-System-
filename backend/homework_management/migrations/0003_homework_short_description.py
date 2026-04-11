from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("homework_management", "0002_homeworksubmission_content_html"),
    ]

    operations = [
        migrations.AddField(
            model_name="homework",
            name="short_description",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]

