from django.conf import settings
from django.db import models

from classes.models import Classroom


class ClassRoutine(models.Model):
    DAY_SAT = 0
    DAY_SUN = 1
    DAY_MON = 2
    DAY_TUE = 3
    DAY_WED = 4
    DAY_THU = 5
    DAY_FRI = 6

    DAY_CHOICES = [
        (DAY_SAT, "Saturday"),
        (DAY_SUN, "Sunday"),
        (DAY_MON, "Monday"),
        (DAY_TUE, "Tuesday"),
        (DAY_WED, "Wednesday"),
        (DAY_THU, "Thursday"),
        (DAY_FRI, "Friday"),
    ]

    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name="routines")
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="routines")
    day_of_week = models.PositiveSmallIntegerField(choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    title = models.CharField(max_length=200, blank=True, default="")
    room = models.CharField(max_length=100, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["day_of_week", "start_time"]
        indexes = [
            models.Index(fields=["classroom", "day_of_week", "start_time"]),
        ]

    def __str__(self) -> str:
        return f"{self.classroom_id} {self.get_day_of_week_display()} {self.start_time}-{self.end_time}"

