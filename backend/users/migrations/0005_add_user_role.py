from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0004_normalize_dedupe_portalrolepermission_path"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("ADMIN", "Admin"),
                    ("USER", "User"),
                    ("TEACHER", "Teacher"),
                    ("STUDENT", "Student"),
                    ("PARENT", "Parent"),
                ],
                default="PARENT",
                max_length=20,
            ),
        ),
    ]

