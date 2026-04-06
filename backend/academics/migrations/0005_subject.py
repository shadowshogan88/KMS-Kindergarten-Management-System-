from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("academics", "0004_section_name"),
    ]

    operations = [
        migrations.CreateModel(
            name="Subject",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("code", models.CharField(max_length=30, unique=True)),
                ("subject_type", models.CharField(choices=[("THEORY", "Theory"), ("PRACTICAL", "Practical")], default="THEORY", max_length=10)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["code"],
            },
        ),
        migrations.AddConstraint(
            model_name="subject",
            constraint=models.UniqueConstraint(fields=("name",), name="uniq_subject_name"),
        ),
    ]

