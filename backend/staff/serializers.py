from rest_framework import serializers

from .models import Employee, FinanceTransaction, LeaveRequest, PayrollSalary, Payslip, StaffAttendanceRecord


class EmployeeSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    department_name = serializers.CharField(source="department.name", read_only=True)
    designation_name = serializers.CharField(source="designation.name", read_only=True)

    class Meta:
        model = Employee
        fields = (
            "id",
            "code",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "phone",
            "address",
            "department",
            "department_name",
            "designation",
            "designation_name",
            "join_date",
            "is_active",
            "created_at",
            "updated_at",
        )

    def get_full_name(self, obj: Employee) -> str:
        return f"{obj.first_name} {obj.last_name}".strip()


class StaffAttendanceRecordSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.code", read_only=True)
    employee_name = serializers.CharField(source="employee.__str__", read_only=True)

    class Meta:
        model = StaffAttendanceRecord
        fields = (
            "id",
            "employee",
            "employee_code",
            "employee_name",
            "date",
            "status",
            "check_in",
            "check_out",
            "meal_break_minutes",
            "overtime_minutes",
            "note",
            "created_at",
            "updated_at",
        )


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.code", read_only=True)
    employee_name = serializers.CharField(source="employee.__str__", read_only=True)
    no_of_days = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequest
        fields = (
            "id",
            "employee",
            "employee_code",
            "employee_name",
            "leave_type",
            "reason",
            "start_date",
            "end_date",
            "no_of_days",
            "status",
            "created_at",
            "updated_at",
        )

    def get_no_of_days(self, obj: LeaveRequest) -> int:
        if not obj.start_date or not obj.end_date:
            return 0
        return (obj.end_date - obj.start_date).days + 1


class PayrollSalarySerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.code", read_only=True)
    employee_name = serializers.CharField(source="employee.__str__", read_only=True)

    class Meta:
        model = PayrollSalary
        fields = (
            "id",
            "employee",
            "employee_code",
            "employee_name",
            "effective_from",
            "base_salary",
            "bonus",
            "created_at",
            "updated_at",
        )


class PayslipSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.code", read_only=True)
    employee_name = serializers.CharField(source="employee.__str__", read_only=True)

    class Meta:
        model = Payslip
        fields = (
            "id",
            "employee",
            "employee_code",
            "employee_name",
            "month",
            "salary_amount",
            "deductions",
            "tax",
            "provident_fund",
            "net_payable",
            "status",
            "created_at",
            "updated_at",
        )


class FinanceTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinanceTransaction
        fields = (
            "id",
            "code",
            "tx_type",
            "party_name",
            "tx_by",
            "tx_date",
            "expiry_date",
            "amount",
            "status",
            "note",
            "created_at",
            "updated_at",
        )

