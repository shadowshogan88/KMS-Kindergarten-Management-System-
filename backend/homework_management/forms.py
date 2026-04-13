from django import forms

from homework_management.models import Homework, HomeworkSubmission, SubmissionAnnotation, SubmissionImage


class HomeworkForm(forms.ModelForm):
    class Meta:
        model = Homework
        fields = (
            "title",
            "short_description",
            "homework_type",
            "class_name",
            "section",
            "subject",
            "special_live_class",
            "class_date",
            "description",
            "pdf_file",
            "due_date",
            "allow_late_submission",
            "status",
        )


class HomeworkSubmissionForm(forms.ModelForm):
    class Meta:
        model = HomeworkSubmission
        fields = ("homework", "student", "status")


class SubmissionImageForm(forms.ModelForm):
    class Meta:
        model = SubmissionImage
        fields = ("submission", "image", "page_number")


class SubmissionAnnotationForm(forms.ModelForm):
    class Meta:
        model = SubmissionAnnotation
        fields = ("submission_image", "annotation_data")
