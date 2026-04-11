from django import forms

from .models import Exam, StudentExamMark


class ExamForm(forms.ModelForm):
    class Meta:
        model = Exam
        fields = ("exam_name", "class_name", "section", "exam_type", "start_date", "end_date", "status")


class StudentExamMarkForm(forms.ModelForm):
    class Meta:
        model = StudentExamMark
        fields = ("student", "exam", "subject", "marks_obtained", "remarks")

