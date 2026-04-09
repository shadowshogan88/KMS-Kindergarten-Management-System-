import datetime

from .models import Holiday, WeeklyHoliday


DAY_TABS = [
    {"label": "Saturday", "value": 0},
    {"label": "Sunday", "value": 1},
    {"label": "Monday", "value": 2},
    {"label": "Tuesday", "value": 3},
    {"label": "Wednesday", "value": 4},
    {"label": "Thursday", "value": 5},
    {"label": "Friday", "value": 6},
]


def date_to_day_of_week(date_obj: datetime.date) -> int:
    """
    Convert python weekday (Mon=0..Sun=6) to routines weekday (Sat=0..Fri=6).
    """
    return (date_obj.weekday() + 2) % 7


def get_active_weekly_holiday():
    weekly = WeeklyHoliday.objects.filter(is_active=True, singleton_key=1).first()
    if not weekly:
        return None
    if not isinstance(weekly.days, list):
        return None
    normalized = []
    for d in weekly.days or []:
        try:
            d = int(d)
        except Exception:
            continue
        if 0 <= d <= 6 and d not in normalized:
            normalized.append(d)
    return {
        "days": set(normalized),
        "title": (weekly.title or "").strip() or "Weekly Holiday",
        "description": weekly.description or "",
    }


def get_weekly_holiday_for_day(day_of_week: int):
    weekly = get_active_weekly_holiday()
    if not weekly:
        return None
    try:
        day_of_week = int(day_of_week)
    except Exception:
        return None
    if day_of_week in weekly["days"]:
        return weekly
    return None


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

    weekly = get_active_weekly_holiday()
    if weekly and date_to_day_of_week(date_obj) in weekly["days"]:
        return {
            "kind": "WEEKLY",
            "date": str(date_obj),
            "title": weekly["title"],
            "description": weekly["description"],
        }

    return None
