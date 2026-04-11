from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render

from homework_management.models import Homework


@login_required
def homework_list(request: HttpRequest) -> HttpResponse:
    qs = Homework.objects.select_related("class_name", "subject", "created_by").all().order_by("-created_at", "-id")[:100]
    return render(request, "homework_management/homework_list.html", {"items": qs})


@login_required
def assignment_editor(request: HttpRequest) -> HttpResponse:
    return render(request, "homework_management/assignment_editor.html")
