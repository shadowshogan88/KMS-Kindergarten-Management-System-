from rest_framework import serializers

from .models import AcademicClassRoutine, AcademicClassRoutineOverride, ClassRoutine


class ClassRoutineSerializer(serializers.ModelSerializer):
    classroom_name = serializers.CharField(source="classroom.name", read_only=True)
    teacher_name = serializers.SerializerMethodField()
    day_label = serializers.CharField(source="get_day_of_week_display", read_only=True)

    class Meta:
        model = ClassRoutine
        fields = (
            "id",
            "classroom",
            "classroom_name",
            "teacher",
            "teacher_name",
            "day_of_week",
            "day_label",
            "start_time",
            "end_time",
            "title",
            "room",
            "created_at",
        )
        read_only_fields = ("created_at",)

    def get_teacher_name(self, obj):
        full = f"{obj.teacher.first_name} {obj.teacher.last_name}".strip()
        return full or obj.teacher.username

    def validate(self, attrs):
        day = attrs.get("day_of_week", getattr(self.instance, "day_of_week", None))
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        classroom = attrs.get("classroom", getattr(self.instance, "classroom", None))

        if day == ClassRoutine.DAY_FRI:
            raise serializers.ValidationError({"day_of_week": "Friday is a break day. No routines allowed."})

        if start and end and start >= end:
            raise serializers.ValidationError({"end_time": "end_time must be after start_time."})

        # Basic overlap check within the same classroom/day
        if classroom and day is not None and start and end:
            qs = ClassRoutine.objects.filter(classroom=classroom, day_of_week=day)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            overlap = qs.filter(start_time__lt=end, end_time__gt=start).exists()
            if overlap:
                raise serializers.ValidationError("Time overlaps with an existing routine for this class/day.")

        return attrs


class AcademicClassRoutineSerializer(serializers.ModelSerializer):
    school_class_name = serializers.CharField(source="school_class.name", read_only=True)
    school_class_label = serializers.CharField(read_only=True)
    subject_label = serializers.CharField(read_only=True)
    subject_teacher_label = serializers.CharField(read_only=True)
    subject_type = serializers.CharField(source="subject.subject_type", read_only=True)
    day_label = serializers.CharField(source="get_day_of_week_display", read_only=True)

    class Meta:
        model = AcademicClassRoutine
        fields = (
            "id",
            "school_class",
            "school_class_name",
            "section",
            "school_class_label",
            "routine_type",
            "title",
            "subject",
            "subject_teacher",
            "subject_label",
            "subject_teacher_label",
            "subject_type",
            "live_enabled",
            "meet_link",
            "day_of_week",
            "day_label",
            "start_time",
            "end_time",
            "room",
            "created_at",
        )
        read_only_fields = ("created_at",)

    def validate(self, attrs):
        day = attrs.get("day_of_week", getattr(self.instance, "day_of_week", None))
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        school_class = attrs.get("school_class", getattr(self.instance, "school_class", None))
        section = attrs.get("section", getattr(self.instance, "section", "")) or ""
        routine_type = (attrs.get("routine_type", getattr(self.instance, "routine_type", AcademicClassRoutine.TYPE_PERIOD)) or "").strip().upper()
        title = attrs.get("title", getattr(self.instance, "title", "")) or ""
        subject = attrs.get("subject", getattr(self.instance, "subject", None))

        if day == AcademicClassRoutine.DAY_FRI:
            raise serializers.ValidationError({"day_of_week": "Friday is a break day. No routines allowed."})

        if start and end and start >= end:
            raise serializers.ValidationError({"end_time": "end_time must be after start_time."})

        if routine_type not in {AcademicClassRoutine.TYPE_PERIOD, AcademicClassRoutine.TYPE_BREAK}:
            raise serializers.ValidationError({"routine_type": "Invalid routine type."})
        attrs["routine_type"] = routine_type

        if school_class:
            class_sections = list(school_class.sections or [])
            section = section.strip().upper()
            if class_sections:
                if not section:
                    raise serializers.ValidationError({"section": "Section is required for this class."})
                if section not in class_sections:
                    raise serializers.ValidationError({"section": f"Section must be one of: {', '.join(class_sections)}."})
            else:
                if section:
                    raise serializers.ValidationError({"section": "This class has no sections; leave section empty."})
            attrs["section"] = section

        if routine_type == AcademicClassRoutine.TYPE_BREAK:
            if subject is not None:
                raise serializers.ValidationError({"subject": "Break routine cannot have a subject."})
            if attrs.get("subject_teacher", getattr(self.instance, "subject_teacher", None)) is not None:
                raise serializers.ValidationError({"subject_teacher": "Break routine cannot have a subject teacher."})
            if attrs.get("live_enabled", getattr(self.instance, "live_enabled", False)):
                raise serializers.ValidationError({"live_enabled": "Break routine cannot be a live class."})
            if not title.strip():
                raise serializers.ValidationError({"title": "Title is required for break routine (e.g. Tiffin)."})
        else:
            if subject is None:
                raise serializers.ValidationError({"subject": "Subject is required for period routine."})

        if school_class and day is not None and start and end:
            qs = AcademicClassRoutine.objects.filter(school_class=school_class, section=section, day_of_week=day)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            overlap = qs.filter(start_time__lt=end, end_time__gt=start).exists()
            if overlap:
                raise serializers.ValidationError("Time overlaps with an existing routine for this class/section/day.")

        return attrs


class AcademicClassRoutineOverrideSerializer(serializers.ModelSerializer):
    routine_id = serializers.IntegerField(source="routine.id", read_only=True)
    subject_label = serializers.CharField(source="routine.subject_label", read_only=True)
    subject_teacher_label = serializers.CharField(source="routine.subject_teacher_label", read_only=True)
    routine_type = serializers.CharField(source="routine.routine_type", read_only=True)

    class Meta:
        model = AcademicClassRoutineOverride
        fields = (
            "id",
            "routine",
            "routine_id",
            "date",
            "start_time",
            "end_time",
            "meet_link",
            "meet_event_id",
            "routine_type",
            "subject_label",
            "subject_teacher_label",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("meet_link", "meet_event_id", "created_at", "updated_at")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start and end and start >= end:
            raise serializers.ValidationError({"end_time": "end_time must be after start_time."})
        return attrs
