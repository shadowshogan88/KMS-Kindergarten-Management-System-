from rest_framework.routers import DefaultRouter

from .api_views import (
    EmployeeViewSet,
    FinanceTransactionViewSet,
    LeaveRequestViewSet,
    PayrollSalaryViewSet,
    PayslipViewSet,
    StaffAttendanceViewSet,
)

router = DefaultRouter()
router.register(r"employees", EmployeeViewSet, basename="employee")
router.register(r"staff-attendance", StaffAttendanceViewSet, basename="staff_attendance")
router.register(r"leave-requests", LeaveRequestViewSet, basename="leave_request")
router.register(r"payroll-salaries", PayrollSalaryViewSet, basename="payroll_salary")
router.register(r"payslips", PayslipViewSet, basename="payslip")
router.register(r"finance-transactions", FinanceTransactionViewSet, basename="finance_transaction")

urlpatterns = router.urls

