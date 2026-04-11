from __future__ import annotations

from io import BytesIO

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import FileResponse
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from academics.models import ClassTeacher
from students.models import Student
from users.rbac_permissions import HasPortalPermission

from homework_management.models import Homework, HomeworkGradeLog, HomeworkSubmission, SubmissionAnnotation, SubmissionImage
from homework_management.permissions import IsAdmin, IsStudent, IsTeacher, TeacherHasClassroomAccess
from homework_management.serializers import (
    HomeworkGradeLogSerializer,
    HomeworkSerializer,
    HomeworkSubmissionSerializer,
    SubmissionAnnotationSerializer,
    SubmissionImageSerializer,
)
from homework_management.services.pdf_export import export_submission_images_pdf


class HomeworkViewSet(viewsets.ModelViewSet):
    queryset = Homework.objects.select_related("class_name", "subject", "created_by").all()
    serializer_class = HomeworkSerializer
    rbac_path = "/portal/homework"
    rbac_action_map = {"publish": "edit"}

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy", "publish"}:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsAdmin | IsTeacher]
        else:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        q = (self.request.query_params.get("q") or "").strip()
        class_id = self.request.query_params.get("class") or self.request.query_params.get("class_name")
        subject_id = self.request.query_params.get("subject")
        hw_type = (self.request.query_params.get("type") or "").strip().upper()

        if class_id:
            qs = qs.filter(class_name_id=class_id)
        if subject_id:
            qs = qs.filter(subject_id=subject_id)
        if hw_type in {Homework.TYPE_HOMEWORK, Homework.TYPE_ASSIGNMENT}:
            qs = qs.filter(homework_type=hw_type)
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(short_description__icontains=q) | Q(description__icontains=q))

        role = getattr(user, "role", None)
        if role == "STUDENT":
            student = getattr(user, "student_profile", None)
            if student:
                qs = qs.filter(class_name_id=student.school_class_id, section=(student.section or ""))
            else:
                qs = qs.none()
        elif role == "TEACHER":
            # Teacher can see for assigned classrooms.
            assignments = list(
                ClassTeacher.objects.filter(teacher__user_id=user.id).values_list("school_class_id", "section")
            )
            if not assignments:
                return qs.none()
            clause = Q()
            for c_id, sec in assignments:
                clause |= Q(class_name_id=c_id, section=(sec or ""))
            qs = qs.filter(clause)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if getattr(user, "role", None) == "TEACHER":
            class_name = serializer.validated_data["class_name"]
            section = (serializer.validated_data.get("section") or "").strip().upper()
            ok = ClassTeacher.objects.filter(school_class=class_name, section=section, teacher__user_id=user.id).exists()
            if not ok:
                raise PermissionDenied("Not your assigned class.")
        serializer.save(created_by=user)

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, pk=None):
        hw = self.get_object()
        if hw.status == Homework.STATUS_PUBLISHED:
            return Response({"published": True})
        hw.status = Homework.STATUS_PUBLISHED
        hw.save(update_fields=["status", "updated_at"])
        return Response({"published": True})


class SubmissionViewSet(viewsets.ModelViewSet):
    queryset = HomeworkSubmission.objects.select_related("homework", "student", "homework__class_name").prefetch_related("images").all()
    serializer_class = HomeworkSubmissionSerializer
    rbac_path = "/portal/homework/submissions"
    rbac_action_map = {"submit": "edit", "grade": "edit", "export_pdf": "view"}

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy", "submit"}:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsAdmin | IsStudent]
        elif self.action in {"grade"}:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsAdmin | IsTeacher]
        else:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        homework_id = self.request.query_params.get("homework")
        if homework_id:
            qs = qs.filter(homework_id=homework_id)

        role = getattr(user, "role", None)
        if role == "STUDENT":
            return qs.filter(student__user_id=user.id)
        if role == "TEACHER":
            assignments = list(
                ClassTeacher.objects.filter(teacher__user_id=user.id).values_list("school_class_id", "section")
            )
            if not assignments:
                return qs.none()
            clause = Q()
            for c_id, sec in assignments:
                clause |= Q(homework__class_name_id=c_id, homework__section=(sec or ""))
            return qs.filter(clause)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        role = getattr(user, "role", None)
        if role != "STUDENT":
            raise PermissionDenied("Only students can create submissions.")
        student = getattr(user, "student_profile", None)
        if not student:
            raise PermissionDenied("Student profile not found.")
        serializer.save(student=student)

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        submission = self.get_object()
        user = request.user
        if getattr(user, "role", None) == "STUDENT" and getattr(submission.student, "user_id", None) != user.id:
            raise PermissionDenied("Not allowed.")
        submission.status = HomeworkSubmission.STATUS_SUBMITTED
        submission.submitted_at = timezone.now()
        submission.save()
        return Response({"submitted": True, "is_late_submission": submission.is_late_submission})

    @action(detail=True, methods=["post"], url_path="grade")
    def grade(self, request, pk=None):
        submission = self.get_object()
        if getattr(request.user, "role", None) == "TEACHER":
            if not TeacherHasClassroomAccess().has_object_permission(request, self, submission.homework):
                raise PermissionDenied("Not allowed.")

        marks = request.data.get("marks", None)
        feedback = (request.data.get("feedback") or "").strip()
        if marks is None:
            raise ValidationError({"marks": "marks is required."})
        try:
            marks_val = float(marks)
        except Exception:
            raise ValidationError({"marks": "marks must be a number."})

        submission.teacher_marks = marks_val
        submission.teacher_feedback = feedback
        submission.status = HomeworkSubmission.STATUS_GRADED
        submission.save(update_fields=["teacher_marks", "teacher_feedback", "status", "updated_at"])
        HomeworkGradeLog.objects.create(submission=submission, marks=marks_val, graded_by=request.user)
        return Response({"graded": True})

    @action(detail=True, methods=["get"], url_path="export-pdf")
    def export_pdf(self, request, pk=None):
        submission = self.get_object()
        user = request.user
        role = getattr(user, "role", None)
        if role == "STUDENT" and getattr(submission.student, "user_id", None) != user.id:
            raise PermissionDenied("Not allowed.")
        if role == "TEACHER" and not TeacherHasClassroomAccess().has_object_permission(request, self, submission.homework):
            raise PermissionDenied("Not allowed.")

        try:
            content, filename = export_submission_images_pdf(submission=submission)
        except ValueError as e:
            raise ValidationError({"detail": str(e)})
        return FileResponse(BytesIO(content), as_attachment=True, filename=filename, content_type="application/pdf")


class SubmissionImageViewSet(viewsets.ModelViewSet):
    queryset = SubmissionImage.objects.select_related("submission", "submission__homework", "submission__student").all()
    serializer_class = SubmissionImageSerializer
    rbac_path = "/portal/homework/submission-images"
    rbac_action_map = {"reorder": "edit"}

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy", "reorder"}:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsAdmin | IsStudent]
        else:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        submission_id = self.request.query_params.get("submission")
        if submission_id:
            qs = qs.filter(submission_id=submission_id)

        role = getattr(user, "role", None)
        if role == "STUDENT":
            return qs.filter(submission__student__user_id=user.id)
        if role == "TEACHER":
            assignments = list(
                ClassTeacher.objects.filter(teacher__user_id=user.id).values_list("school_class_id", "section")
            )
            if not assignments:
                return qs.none()
            clause = Q()
            for c_id, sec in assignments:
                clause |= Q(submission__homework__class_name_id=c_id, submission__homework__section=(sec or ""))
            return qs.filter(clause)
        return qs

    def perform_create(self, serializer):
        submission = serializer.validated_data["submission"]
        user = self.request.user
        role = getattr(user, "role", None)

        if submission.homework.status != Homework.STATUS_PUBLISHED:
            raise ValidationError({"submission": "Homework is not published."})

        if submission.homework.due_date and timezone.now() > submission.homework.due_date and not submission.homework.allow_late_submission:
            raise ValidationError({"submission": "Deadline passed. Upload is locked."})

        if role == "STUDENT" and getattr(submission.student, "user_id", None) != user.id:
            raise PermissionDenied("Not allowed.")

        # Auto-assign next page_number if missing or collides.
        page_number = serializer.validated_data.get("page_number") or 0
        if page_number < 1:
            max_page = SubmissionImage.objects.filter(submission=submission).order_by("-page_number").values_list("page_number", flat=True).first()
            serializer.validated_data["page_number"] = int(max_page or 0) + 1
        serializer.save()

    @action(detail=False, methods=["post"], url_path="reorder")
    def reorder(self, request):
        """
        Payload:
        { "submission": 1, "ordered_image_ids": [10,11,12] }
        """
        submission_id = request.data.get("submission")
        ordered_ids = request.data.get("ordered_image_ids") or []
        if not submission_id:
            raise ValidationError({"submission": "submission is required."})
        if not isinstance(ordered_ids, list) or not ordered_ids:
            raise ValidationError({"ordered_image_ids": "ordered_image_ids must be a non-empty list."})

        try:
            submission = HomeworkSubmission.objects.select_related("student").get(id=submission_id)
        except HomeworkSubmission.DoesNotExist:
            raise ValidationError({"submission": "Submission not found."})

        if getattr(request.user, "role", None) == "STUDENT" and getattr(submission.student, "user_id", None) != request.user.id:
            raise PermissionDenied("Not allowed.")

        images = list(SubmissionImage.objects.filter(submission=submission, id__in=ordered_ids))
        if len(images) != len(set(ordered_ids)):
            raise ValidationError({"ordered_image_ids": "Some images not found for this submission."})

        id_to_obj = {img.id: img for img in images}
        with transaction.atomic():
            for idx, img_id in enumerate(ordered_ids, start=1):
                obj = id_to_obj.get(img_id)
                if not obj:
                    continue
                if obj.page_number != idx:
                    obj.page_number = idx
                    obj.save(update_fields=["page_number", "updated_at"])
        return Response({"reordered": True})


class AnnotationViewSet(viewsets.ModelViewSet):
    queryset = SubmissionAnnotation.objects.select_related("submission_image", "created_by").all()
    serializer_class = SubmissionAnnotationSerializer
    rbac_path = "/portal/homework/annotations"

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsAdmin | IsTeacher | IsStudent]
        else:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        image_id = self.request.query_params.get("submission_image")
        if image_id:
            qs = qs.filter(submission_image_id=image_id)

        role = getattr(user, "role", None)
        if role == "TEACHER":
            assignments = list(
                ClassTeacher.objects.filter(teacher__user_id=user.id).values_list("school_class_id", "section")
            )
            if not assignments:
                return qs.none()
            clause = Q()
            for c_id, sec in assignments:
                clause |= Q(submission_image__submission__homework__class_name_id=c_id, submission_image__submission__homework__section=(sec or ""))
            return qs.filter(clause)
        if role == "STUDENT":
            return qs.filter(submission_image__submission__student__user_id=user.id)
        return qs

    def perform_create(self, serializer):
        role = getattr(self.request.user, "role", None)
        submission_image = serializer.validated_data["submission_image"]

        if role == "TEACHER":
            if not TeacherHasClassroomAccess().has_object_permission(self.request, self, submission_image.submission.homework):
                raise PermissionDenied("Not allowed.")
        elif role == "STUDENT":
            if getattr(submission_image.submission.student, "user_id", None) != self.request.user.id:
                raise PermissionDenied("Not allowed.")
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        obj = self.get_object()
        role = getattr(self.request.user, "role", None)
        if role == "TEACHER":
            if not TeacherHasClassroomAccess().has_object_permission(self.request, self, obj.submission_image.submission.homework):
                raise PermissionDenied("Not allowed.")
        elif role == "STUDENT":
            if obj.created_by_id != self.request.user.id:
                raise PermissionDenied("Not allowed.")
            if getattr(obj.submission_image.submission.student, "user_id", None) != self.request.user.id:
                raise PermissionDenied("Not allowed.")
        serializer.save()

    def perform_destroy(self, instance):
        role = getattr(self.request.user, "role", None)
        if role == "TEACHER":
            if not TeacherHasClassroomAccess().has_object_permission(self.request, self, instance.submission_image.submission.homework):
                raise PermissionDenied("Not allowed.")
        elif role == "STUDENT":
            if instance.created_by_id != self.request.user.id:
                raise PermissionDenied("Not allowed.")
            if getattr(instance.submission_image.submission.student, "user_id", None) != self.request.user.id:
                raise PermissionDenied("Not allowed.")
        instance.delete()


class GradeLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = HomeworkGradeLog.objects.select_related("submission", "graded_by").all()
    serializer_class = HomeworkGradeLogSerializer
    rbac_path = "/portal/homework/grades"

    def get_permissions(self):
        self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsAdmin | IsTeacher]
        return super().get_permissions()
