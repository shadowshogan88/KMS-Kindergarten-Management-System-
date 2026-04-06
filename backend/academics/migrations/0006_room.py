from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("academics", "0005_subject"),
    ]

    operations = [
        migrations.CreateModel(
            name="Room",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("room_no", models.CharField(max_length=30, unique=True)),
                ("capacity", models.PositiveIntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["room_no"],
            },
        ),
    ]

