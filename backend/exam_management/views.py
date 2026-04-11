from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render

from exam_management.models import Exam, Promotion


@login_required
def exam_list_page(request: HttpRequest) -> HttpResponse:
    exams = Exam.objects.select_related("class_name").all().order_by("-start_date", "-id")[:100]
    return render(request, "exam_management/exam_list.html", {"exams": exams})


@login_required
def promotion_history_page(request: HttpRequest) -> HttpResponse:
    promotions = Promotion.objects.select_related("student", "from_class", "to_class").all().order_by("-promoted_at", "-id")[:200]
    return render(request, "exam_management/promotion_history.html", {"promotions": promotions})

