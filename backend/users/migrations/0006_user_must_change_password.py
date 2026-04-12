from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0005_add_user_role"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="must_change_password",
            field=models.BooleanField(
                default=False,
                help_text="If true, user should be prompted to change password after login (no current password required).",
            ),
        ),
    ]

