from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import PortalRole, PortalRolePermission, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Kindergarten", {"fields": ("role", "portal_role", "phone")}),
    )
    list_display = ("username", "email", "first_name", "last_name", "role", "is_staff")
    list_filter = ("role", "is_staff", "is_active")


@admin.register(PortalRole)
class PortalRoleAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "created_at", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(PortalRolePermission)
class PortalRolePermissionAdmin(admin.ModelAdmin):
    list_display = ("role", "path", "can_view", "can_create", "can_edit", "can_delete", "updated_at")
    list_filter = ("role", "can_view", "can_create", "can_edit", "can_delete")
    search_fields = ("path", "role__name")
