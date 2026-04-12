from django.contrib import admin

from .models import Employee, FinanceTransaction, LeaveRequest, PayrollSalary, Payslip, StaffAttendanceRecord


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("code", "first_name", "last_name", "department", "designation", "is_active", "updated_at")
    search_fields = ("code", "first_name", "last_name", "email", "phone")
    list_filter = ("is_active", "department", "designation")


@admin.register(StaffAttendanceRecord)
class StaffAttendanceRecordAdmin(admin.ModelAdmin):
    list_display = ("employee", "date", "status", "check_in", "check_out", "updated_at")
    search_fields = ("employee__code", "employee__first_name", "employee__last_name", "note")
    list_filter = ("status", "date")


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ("employee", "leave_type", "start_date", "end_date", "status", "updated_at")
    search_fields = ("employee__code", "employee__first_name", "employee__last_name", "leave_type")
    list_filter = ("status", "leave_type")


@admin.register(PayrollSalary)
class PayrollSalaryAdmin(admin.ModelAdmin):
    list_display = ("employee", "effective_from", "base_salary", "bonus", "updated_at")
    search_fields = ("employee__code", "employee__first_name", "employee__last_name")
    list_filter = ("effective_from",)


@admin.register(Payslip)
class PayslipAdmin(admin.ModelAdmin):
    list_display = ("employee", "month", "net_payable", "status", "updated_at")
    search_fields = ("employee__code", "employee__first_name", "employee__last_name")
    list_filter = ("status", "month")


@admin.register(FinanceTransaction)
class FinanceTransactionAdmin(admin.ModelAdmin):
    list_display = ("code", "tx_type", "party_name", "tx_date", "amount", "status", "updated_at")
    search_fields = ("code", "party_name", "tx_by", "status", "note")
    list_filter = ("tx_type", "tx_date", "status")

