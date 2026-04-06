from rest_framework import serializers

from .models import Announcement


class AnnouncementSerializer(serializers.ModelSerializer):
    classroom_name = serializers.CharField(source="classroom.name", read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = Announcement
        fields = (
            "id",
            "title",
            "message",
            "audience",
            "classroom",
            "classroom_name",
            "created_by",
            "created_by_username",
            "publish_at",
            "created_at",
        )
        read_only_fields = ("created_by", "created_at")

