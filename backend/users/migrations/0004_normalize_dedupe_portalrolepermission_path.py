from django.db import migrations


def normalize_path(v: str) -> str:
    s = (v or "").strip()
    if not s:
        return s
    if not s.startswith("/"):
        s = f"/{s}"
    if len(s) > 1:
        s = s.rstrip("/")
    return s


def forwards(apps, schema_editor):
    PortalRolePermission = apps.get_model("users", "PortalRolePermission")

    groups = {}
    delete_ids = set()

    # Ensure deterministic behavior.
    qs = PortalRolePermission.objects.all().order_by("role_id", "id")

    for row in qs.iterator():
        norm = normalize_path(row.path)
        key = (row.role_id, norm)
        g = groups.get(key)
        if not g:
            groups[key] = {
                "primary_id": row.id,
                "has_norm_primary": row.path == norm,
                "can_view": bool(row.can_view),
                "can_create": bool(row.can_create),
                "can_edit": bool(row.can_edit),
                "can_delete": bool(row.can_delete),
            }
            continue

        # Merge flags
        g["can_view"] = g["can_view"] or bool(row.can_view)
        g["can_create"] = g["can_create"] or bool(row.can_create)
        g["can_edit"] = g["can_edit"] or bool(row.can_edit)
        g["can_delete"] = g["can_delete"] or bool(row.can_delete)

        if row.path == norm and not g["has_norm_primary"]:
            # Prefer the already-normalized row as primary.
            delete_ids.add(g["primary_id"])
            g["primary_id"] = row.id
            g["has_norm_primary"] = True
            continue

        delete_ids.add(row.id)

    if delete_ids:
        PortalRolePermission.objects.filter(id__in=list(delete_ids)).delete()

    # Update remaining primaries.
    for (role_id, norm), g in groups.items():
        PortalRolePermission.objects.filter(id=g["primary_id"]).update(
            path=norm,
            can_view=g["can_view"],
            can_create=g["can_create"],
            can_edit=g["can_edit"],
            can_delete=g["can_delete"],
        )


def backwards(apps, schema_editor):
    # Best-effort: keep normalized paths; no safe way to restore deleted duplicates.
    return


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0003_portalrole_user_portal_role_portalrolepermission"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]

