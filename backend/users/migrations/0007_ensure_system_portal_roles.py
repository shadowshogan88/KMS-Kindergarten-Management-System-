from django.db import migrations


SYSTEM_ROLES = ("Parents", "Students", "Teachers")


def ensure_system_roles(apps, schema_editor):
    PortalRole = apps.get_model("users", "PortalRole")

    for name in SYSTEM_ROLES:
        # Prefer exact match, then case-insensitive match.
        obj = PortalRole.objects.filter(name=name).first() or PortalRole.objects.filter(name__iexact=name).first()
        if obj:
            updates = []
            if obj.name != name and not PortalRole.objects.filter(name=name).exists():
                obj.name = name
                updates.append("name")
            if not getattr(obj, "is_active", True):
                obj.is_active = True
                updates.append("is_active")
            if updates:
                obj.save(update_fields=updates)
        else:
            PortalRole.objects.create(name=name, is_active=True)


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0006_user_must_change_password"),
    ]

    operations = [
        migrations.RunPython(ensure_system_roles, migrations.RunPython.noop),
    ]

