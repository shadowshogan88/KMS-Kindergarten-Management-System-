from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("academics", "0003_section"),
    ]

    operations = [
        migrations.DeleteModel(
            name="Section",
        ),
        migrations.CreateModel(
            name="Section",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=50, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["name"],
            },
        ),
    ]

