# Generated manually
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("academics", "0013_classteacher"),
    ]

    operations = [
        migrations.AddField(
            model_name="subject",
            name="full_marks",
            field=models.PositiveIntegerField(default=100),
        ),
        migrations.AddField(
            model_name="subject",
            name="pass_marks",
            field=models.PositiveIntegerField(default=40),
        ),
    ]

