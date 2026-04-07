import datetime

from .models import Holiday, WeeklyHoliday


def date_to_day_of_week(date_obj: datetime.date) -> int:
    """
    Convert python weekday (Mon=0..Sun=6) to routines weekday (Sat=0..Fri=6).
    """
    return (date_obj.weekday() + 2) % 7


def get_holiday_for_date(date_obj: datetime.date):
    """
    Returns a dict describing the holiday for the given date, or None.
    Priority: date holiday > weekly holiday.
    """
    holiday = Holiday.objects.filter(date=date_obj, is_active=True).first()
    if holiday:
        return {
            "kind": "DATE",
            "date": str(holiday.date),
            "title": holiday.title,
            "description": holiday.description or "",
        }

    weekly = WeeklyHoliday.objects.filter(is_active=True, singleton_key=1).first()
    if weekly and isinstance(weekly.days, list) and date_to_day_of_week(date_obj) in weekly.days:
        return {
            "kind": "WEEKLY",
            "date": str(date_obj),
            "title": weekly.title or "Weekly Holiday",
            "description": weekly.description or "",
        }

    return None

