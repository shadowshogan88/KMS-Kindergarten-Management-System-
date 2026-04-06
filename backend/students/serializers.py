from rest_framework import serializers

from .models import ParentProfile, Student


class StudentSerializer(serializers.ModelSerializer):
    parent_username = serializers.CharField(source="parent.username", read_only=True)

    class Meta:
        model = Student
        fields = (
            "id",
            "first_name",
            "last_name",
            "date_of_birth",
            "photo",
            "parent",
            "parent_username",
            "medical_info",
            "pickup_authorized_people",
            "created_at",
        )
        read_only_fields = ("created_at",)


class ParentProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParentProfile
        fields = ("id", "user", "address", "emergency_contact_name", "emergency_contact_phone")

