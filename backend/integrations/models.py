from django.db import models
from django.utils import timezone


class GoogleOAuthCredential(models.Model):
    access_token = models.TextField(blank=True, default="")
    refresh_token = models.TextField(blank=True, default="")
    scope = models.TextField(blank=True, default="")
    token_type = models.CharField(max_length=40, blank=True, default="Bearer")
    expires_at = models.DateTimeField(null=True, blank=True)
    calendar_id = models.CharField(max_length=200, blank=True, default="primary")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def is_connected(self) -> bool:
        return bool(self.refresh_token)

    def is_access_token_valid(self) -> bool:
        if not self.access_token or not self.expires_at:
            return False
        # Consider token expired a bit early.
        return self.expires_at > timezone.now() + timezone.timedelta(seconds=60)

    @classmethod
    def get_active(cls):
        return cls.objects.order_by("-updated_at").first()


class GoogleOAuthState(models.Model):
    state = models.CharField(max_length=120, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)

    def mark_used(self):
        if not self.used_at:
            self.used_at = timezone.now()
            self.save(update_fields=["used_at"])

