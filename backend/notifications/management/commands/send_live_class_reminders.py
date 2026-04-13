import datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from classes.models import LiveClass, SpecialLiveClass
from notifications.services import notify_live_class_starting_soon, notify_special_live_class_starting_soon


class Command(BaseCommand):
    help = "Send reminders for live classes that will start within the next 30 minutes."

    def handle(self, *args, **options):
        now = timezone.now()
        horizon = now + datetime.timedelta(minutes=30)
        created_live = 0
        created_special = 0

        live_classes = LiveClass.objects.filter(starts_at__gt=now, starts_at__lte=horizon)
        for obj in live_classes:
            notification, recipients = notify_live_class_starting_soon(obj)
            if notification and recipients:
                created_live += 1

        tz = timezone.get_current_timezone()
        special_classes = SpecialLiveClass.objects.filter(is_active=True)
        for obj in special_classes:
            starts_at = timezone.make_aware(datetime.datetime.combine(obj.date, obj.start_time), tz)
            if now < starts_at <= horizon:
                notification, recipients = notify_special_live_class_starting_soon(obj)
                if notification and recipients:
                    created_special += 1

        self.stdout.write(
            f"live_classes reminders created: {created_live}\n"
            f"special_live_classes reminders created: {created_special}"
        )
