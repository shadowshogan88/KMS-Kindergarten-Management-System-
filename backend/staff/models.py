from django.db import models

from academics.models import Department, Designation


class Employee(models.Model):
    code = models.CharField(max_length=32, unique=True)
    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=40, blank=True, default="")
    address = models.TextField(blank=True, default="")

    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)
    designation = models.ForeignKey(Designation, on_delete=models.SET_NULL, null=True, blank=True)

    join_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["first_name", "last_name", "code"]

    def __str__(self) -> str:
        return f"{self.code} - {self.first_name} {self.last_name}".strip()


class StaffAttendanceRecord(models.Model):
    STATUS_PRESENT = "PRESENT"
    STATUS_ABSENT = "ABSENT"
    STATUS_LEAVE = "LEAVE"
    STATUS_CHOICES = [
        (STATUS_PRESENT, "Present"),
        (STATUS_ABSENT, "Absent"),
        (STATUS_LEAVE, "Leave"),
    ]

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="attendance_records")
    date = models.DateField()
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_PRESENT)
    check_in = models.TimeField(null=True, blank=True)
    check_out = models.TimeField(null=True, blank=True)
    meal_break_minutes = models.PositiveIntegerField(default=0)
    overtime_minutes = models.PositiveIntegerField(default=0)
    note = models.CharField(max_length=255, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "employee__code"]
        constraints = [
            models.UniqueConstraint(fields=["employee", "date"], name="uniq_staff_attendance_per_day")
        ]

    def __str__(self) -> str:
        return f"{self.employee.code} {self.date} {self.status}"


class LeaveRequest(models.Model):
    STATUS_NEW = "NEW"
    STATUS_PENDING = "PENDING"
    STATUS_APPROVED = "APPROVED"
    STATUS_DECLINED = "DECLINED"
    STATUS_CHOICES = [
        (STATUS_NEW, "New"),
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_DECLINED, "Declined"),
    ]

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="leave_requests")
    leave_type = models.CharField(max_length=80)
    reason = models.TextField(blank=True, default="")
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_PENDING)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date", "-created_at"]

    def __str__(self) -> str:
        return f"{self.employee.code} {self.leave_type} {self.start_date} - {self.end_date}"


class PayrollSalary(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="salary_records")
    effective_from = models.DateField()
    base_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    bonus = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-effective_from", "employee__code"]
        constraints = [
            models.UniqueConstraint(fields=["employee", "effective_from"], name="uniq_salary_effective_from")
        ]

    def __str__(self) -> str:
        return f"{self.employee.code} salary from {self.effective_from}"


class Payslip(models.Model):
    STATUS_DRAFT = "DRAFT"
    STATUS_PAID = "PAID"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_PAID, "Paid"),
    ]

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="payslips")
    month = models.DateField(help_text="First day of the month")
    salary_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    provident_fund = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_payable = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_DRAFT)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-month", "employee__code"]
        constraints = [
            models.UniqueConstraint(fields=["employee", "month"], name="uniq_payslip_per_month")
        ]

    def __str__(self) -> str:
        return f"{self.employee.code} payslip {self.month}"


class FinanceTransaction(models.Model):
    TYPE_ESTIMATE = "ESTIMATE"
    TYPE_PAYMENT = "PAYMENT"
    TYPE_EXPENSE = "EXPENSE"
    TYPE_CHOICES = [
        (TYPE_ESTIMATE, "Estimate"),
        (TYPE_PAYMENT, "Payment"),
        (TYPE_EXPENSE, "Expense"),
    ]

    code = models.CharField(max_length=32, unique=True)
    tx_type = models.CharField(max_length=12, choices=TYPE_CHOICES)
    party_name = models.CharField(max_length=160, blank=True, default="")
    tx_by = models.CharField(max_length=80, blank=True, default="")
    tx_date = models.DateField()
    expiry_date = models.DateField(null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=40, blank=True, default="")
    note = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-tx_date", "-created_at"]

    def __str__(self) -> str:
        return f"{self.code} {self.tx_type} {self.amount}"

