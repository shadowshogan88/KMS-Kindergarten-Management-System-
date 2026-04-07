from django.contrib import admin

from .models import GoogleOAuthCredential


@admin.register(GoogleOAuthCredential)
class GoogleOAuthCredentialAdmin(admin.ModelAdmin):
    list_display = ("id", "calendar_id", "expires_at", "updated_at")
    search_fields = ("calendar_id",)

