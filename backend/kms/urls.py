from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("kms.urls_api")),
    path("api/v1/", include("users.urls")),
    path("api/v1/", include("students.urls")),
    path("api/v1/", include("classes.urls")),
    path("api/v1/", include("academics.urls")),
    path("api/v1/", include("attendance.urls")),
    path("api/v1/", include("reports.urls")),
    path("api/v1/", include("notifications.urls")),
    path("api/v1/", include("routines.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
