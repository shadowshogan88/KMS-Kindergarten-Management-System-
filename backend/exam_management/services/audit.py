from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model

from exam_management.models import AuditLog

User = get_user_model()


def create_audit_log(*, action_type: str, user: User | None, details: dict[str, Any] | None = None) -> None:
    AuditLog.objects.create(
        action_type=action_type,
        user=user if getattr(user, "is_authenticated", False) else None,
        details=details or {},
    )

