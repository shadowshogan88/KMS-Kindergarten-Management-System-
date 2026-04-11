from django.urls import path

from .views import assignment_editor, homework_list

urlpatterns = [
    path("homeworks/", homework_list, name="homework_list"),
    path("assignment-editor/", assignment_editor, name="assignment_editor"),
]
