from rest_framework import serializers

from .models import Department, Designation, Room, SchoolClass, Section, Subject, SubjectTeacher


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ("id", "name", "head", "phone", "email", "employees", "created_at", "updated_at")


class SchoolClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolClass
        fields = ("id", "name", "sections", "created_at", "updated_at")


class SectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = ("id", "name", "created_at", "updated_at")


class SubjectSerializer(serializers.ModelSerializer):
    classroom = serializers.CharField(write_only=True, required=False, allow_blank=True)
    classroom_key = serializers.CharField(read_only=True)
    classroom_label = serializers.CharField(read_only=True)
    subject_teacher_label = serializers.CharField(read_only=True)

    class Meta:
        model = Subject
        fields = (
            "id",
            "name",
            "code",
            "subject_teacher",
            "subject_teacher_label",
            "school_class",
            "section",
            "classroom",
            "classroom_key",
            "classroom_label",
            "subject_type",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        attrs = super().validate(attrs)

        classroom = (attrs.pop("classroom", "") or "").strip()
        if classroom:
            if ":" in classroom:
                class_id, section = classroom.split(":", 1)
            else:
                class_id, section = classroom, ""

            try:
                class_id = int(class_id)
            except (TypeError, ValueError):
                raise serializers.ValidationError({"classroom": "Invalid class selection."})

            try:
                school_class = SchoolClass.objects.get(id=class_id)
            except SchoolClass.DoesNotExist:
                raise serializers.ValidationError({"classroom": "Selected class does not exist."})

            attrs["school_class"] = school_class
            attrs["section"] = (section or "").strip().upper()

        is_creating = self.instance is None
        school_class = attrs.get("school_class", getattr(self.instance, "school_class", None))
        if is_creating and not school_class:
            raise serializers.ValidationError({"classroom": "Class is required."})

        subject_teacher = attrs.get("subject_teacher", getattr(self.instance, "subject_teacher", None))
        if is_creating and not subject_teacher:
            raise serializers.ValidationError({"subject_teacher": "Subject teacher is required."})

        section = attrs.get("section", getattr(self.instance, "section", "")) or ""
        section = section.strip().upper()

        if school_class:
            class_sections = list(school_class.sections or [])
            if class_sections:
                if not section:
                    raise serializers.ValidationError({"section": "Section is required for this class."})
                if section not in class_sections:
                    raise serializers.ValidationError({"section": f"Section must be one of: {', '.join(class_sections)}."})
            else:
                if section:
                    raise serializers.ValidationError({"section": "This class has no sections; leave section empty."})

        if "section" in attrs:
            attrs["section"] = section

        return attrs


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ("id", "room_no", "capacity", "created_at", "updated_at")


class DesignationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Designation
        fields = ("id", "title", "created_at", "updated_at")


class SubjectTeacherSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubjectTeacher
        fields = ("id", "name", "phone", "teacher_code", "created_at", "updated_at")
