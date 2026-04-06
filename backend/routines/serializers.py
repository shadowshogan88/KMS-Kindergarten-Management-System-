from rest_framework import serializers

from .models import ClassRoutine


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

