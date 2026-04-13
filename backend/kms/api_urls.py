from django.urls import path

from .api_views import dashboard, server_time

urlpatterns = [
    path("dashboard/", dashboard, name="dashboard"),
    path("time/", server_time, name="server_time"),
]
