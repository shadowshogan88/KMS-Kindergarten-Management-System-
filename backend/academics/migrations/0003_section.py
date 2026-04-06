from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("academics", "0002_schoolclass"),
    ]

    operations = [
        migrations.CreateModel(
            name="Section",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(choices=[("A", "A"), ("B", "B"), ("C", "C"), ("D", "D"), ("E", "E")], max_length=1, unique=True)),
                ("label", models.CharField(blank=True, default="", max_length=50)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["code"],
            },
        ),
    ]

