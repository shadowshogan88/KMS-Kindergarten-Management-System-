from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP


@dataclass(frozen=True)
class GradeBand:
    min_percent: Decimal
    grade: str
    gpa: Decimal


DEFAULT_GRADE_BANDS: list[GradeBand] = [
    GradeBand(Decimal("80"), "A+", Decimal("5.00")),
    GradeBand(Decimal("70"), "A", Decimal("4.00")),
    GradeBand(Decimal("60"), "A-", Decimal("3.50")),
    GradeBand(Decimal("50"), "B", Decimal("3.00")),
    GradeBand(Decimal("40"), "C", Decimal("2.00")),
    GradeBand(Decimal("0"), "F", Decimal("0.00")),
]


def quantize_2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def grade_from_percent(percent: Decimal, bands: list[GradeBand] | None = None) -> tuple[str, Decimal]:
    bands = bands or DEFAULT_GRADE_BANDS
    pct = percent if percent is not None else Decimal("0")
    if pct < 0:
        pct = Decimal("0")
    for band in bands:
        if pct >= band.min_percent:
            return band.grade, band.gpa
    return "F", Decimal("0.00")


def percent_from_marks(marks_obtained: Decimal, full_marks: Decimal) -> Decimal:
    if full_marks <= 0:
        return Decimal("0")
    return (marks_obtained / full_marks) * Decimal("100")


def subject_grade_and_gpa(marks_obtained: Decimal, full_marks: Decimal) -> tuple[str, Decimal, Decimal]:
    percent = percent_from_marks(marks_obtained, full_marks)
    grade, gpa = grade_from_percent(percent)
    return grade, quantize_2(gpa), quantize_2(percent)

