from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.utils.dateparse import parse_date

from homework_management.models import Homework


@login_required
def homework_list(request: HttpRequest) -> HttpResponse:
    date_str = (request.GET.get("date") or "").strip()
    selected_date = parse_date(date_str) if date_str else None

    qs = Homework.objects.select_related("class_name", "subject", "created_by", "special_live_class").all()
    if selected_date:
        qs = qs.filter(class_date=selected_date)
    qs = qs.order_by("-created_at", "-id")[:200]

    return render(
        request,
        "homework_management/homework_list.html",
        {"items": qs, "selected_date": selected_date},
    )


@login_required
def assignment_editor(request: HttpRequest) -> HttpResponse:
    return render(request, "homework_management/assignment_editor.html")
