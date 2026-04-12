from rest_framework import permissions, viewsets
from rest_framework.filters import SearchFilter

from users.permissions import IsAdmin
from users.rbac_permissions import HasPortalPermission

from .models import Employee, FinanceTransaction, LeaveRequest, PayrollSalary, Payslip, StaffAttendanceRecord
from .pagination import StaffPagination
from .serializers import (
    EmployeeSerializer,
    FinanceTransactionSerializer,
    LeaveRequestSerializer,
    PayrollSalarySerializer,
    PayslipSerializer,
    StaffAttendanceRecordSerializer,
)


class _StaffBase(viewsets.ModelViewSet):
    pagination_class = StaffPagination
    filter_backends = [SearchFilter]
    rbac_path = "/portal/department"

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsAdmin]
        else:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission]
        return super().get_permissions()


class EmployeeViewSet(_StaffBase):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer
    search_fields = ["code", "first_name", "last_name", "email", "phone"]


class StaffAttendanceViewSet(_StaffBase):
    queryset = StaffAttendanceRecord.objects.select_related("employee").all()
    serializer_class = StaffAttendanceRecordSerializer
    search_fields = ["employee__code", "employee__first_name", "employee__last_name", "note"]

    def get_queryset(self):
        qs = super().get_queryset()
        employee = self.request.query_params.get("employee")
        date = self.request.query_params.get("date")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if employee:
            qs = qs.filter(employee_id=employee)
        if date:
            qs = qs.filter(date=date)
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        return qs


class LeaveRequestViewSet(_StaffBase):
    queryset = LeaveRequest.objects.select_related("employee").all()
    serializer_class = LeaveRequestSerializer
    search_fields = ["employee__code", "employee__first_name", "employee__last_name", "leave_type", "reason"]

    def get_queryset(self):
        qs = super().get_queryset()
        employee = self.request.query_params.get("employee")
        status_ = self.request.query_params.get("status")
        if employee:
            qs = qs.filter(employee_id=employee)
        if status_:
            qs = qs.filter(status=status_)
        return qs


class PayrollSalaryViewSet(_StaffBase):
    queryset = PayrollSalary.objects.select_related("employee").all()
    serializer_class = PayrollSalarySerializer
    search_fields = ["employee__code", "employee__first_name", "employee__last_name"]

    def get_queryset(self):
        qs = super().get_queryset()
        employee = self.request.query_params.get("employee")
        if employee:
            qs = qs.filter(employee_id=employee)
        return qs


class PayslipViewSet(_StaffBase):
    queryset = Payslip.objects.select_related("employee").all()
    serializer_class = PayslipSerializer
    search_fields = ["employee__code", "employee__first_name", "employee__last_name"]

    def get_queryset(self):
        qs = super().get_queryset()
        employee = self.request.query_params.get("employee")
        if employee:
            qs = qs.filter(employee_id=employee)
        return qs


class FinanceTransactionViewSet(_StaffBase):
    queryset = FinanceTransaction.objects.all()
    serializer_class = FinanceTransactionSerializer
    search_fields = ["code", "party_name", "tx_by", "status", "note"]

    def get_queryset(self):
        qs = super().get_queryset()
        tx_type = self.request.query_params.get("type") or self.request.query_params.get("tx_type")
        if tx_type:
            qs = qs.filter(tx_type=tx_type)
        return qs
