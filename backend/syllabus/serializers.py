from rest_framework import serializers

from .models import Syllabus


class SyllabusSerializer(serializers.ModelSerializer):
    school_class_name = serializers.CharField(source="school_class.name", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    pdf_url = serializers.SerializerMethodField()
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = Syllabus
        fields = (
            "id",
            "school_class",
            "school_class_name",
            "section",
            "subject",
            "subject_code",
            "subject_name",
            "title",
            "description",
            "pdf_file",
            "pdf_url",
            "is_active",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_by", "created_at", "updated_at", "pdf_url")

    def get_pdf_url(self, obj):
        if not obj.pdf_file:
            return ""
        try:
            url = obj.pdf_file.url
        except Exception:
            return ""
        return url

    def validate(self, attrs):
        attrs = super().validate(attrs)
        school_class = attrs.get("school_class", getattr(self.instance, "school_class", None))
        subject = attrs.get("subject", getattr(self.instance, "subject", None))
        if school_class and subject and subject.school_class_id != school_class.id:
            raise serializers.ValidationError({"subject": "Subject must belong to the selected class."})
        return attrs
