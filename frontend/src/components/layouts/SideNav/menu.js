import { LuClipboardList, LuFileText, LuLayoutPanelLeft, LuMonitorDot, LuPictureInPicture2, LuShieldCheck, LuSquareUserRound } from 'react-icons/lu';
export const menuItemsData = [{
  key: 'Overview',
  label: 'Overview',
  isTitle: true
}, {
  key: 'Dashboard',
  label: 'Dashboard',
  icon: LuLayoutPanelLeft,
  href: '/portal/dashboard'
}, {
  key: 'Academics',
  label: 'Academics',
  icon: LuMonitorDot,
  children: [{
    key: 'Classes',
    label: 'Classes',
    href: '/portal/class'
  }, {
    key: 'Sections',
    label: 'Sections',
    href: '/portal/section'
  }, {
    key: 'Subjects',
    label: 'Subjects',
    href: '/portal/subject'
  }, {
    key: 'Teachers',
    label: 'Teachers',
    href: '/portal/teachers'
  }, {
    key: 'Class Teachers',
    label: 'Class Teachers',
    href: '/portal/class-teachers'
  }, {
    key: 'Holidays',
    label: 'Holidays',
    href: '/portal/holidays'
  }, {
    key: 'Weekly Holidays',
    label: 'Weekly Holidays',
    href: '/portal/weekly-holidays'
  }, {
    key: 'StudentsMenu',
    label: 'Students',
    href: '#',
    children: [{
      key: 'Students',
      label: 'Student List',
      href: '/portal/students'
    }, {
      key: 'StudentRollManagement',
      label: 'Roll Management',
      href: '/portal/students?tab=roll'
    }]
  }, {
    key: 'AcademicAttendance',
    label: 'Attendance',
    href: '#',
    children: [{
      key: 'AcademicAttendanceEntry',
      label: 'Attendance',
      href: '/portal/attendance'
    }, {
      key: 'AcademicAttendanceReport',
      label: 'Attendance Report',
      href: '/portal/attendance-report'
    }]
  }, {
    key: 'Class Routine',
    label: 'Class Routine',
    href: '/portal/class-routine'
  }, {
    key: 'Classrooms',
    label: 'Classrooms',
    href: '/portal/classroom'
  }, {
    key: 'Notices',
    label: 'Notices',
    href: '/portal/notices'
  }]
}, {
  key: 'Exam',
  label: 'Exam',
  icon: LuClipboardList,
  children: [{
    key: 'ExamList',
    label: 'Exams',
    href: '/portal/exam/exams'
  }, {
    key: 'ExamMarks',
    label: 'Marks Entry',
    href: '/portal/exam/marks',
    permissionAction: 'edit'
  }, {
    key: 'ExamResults',
    label: 'Results',
    href: '/portal/exam/results'
  }, {
    key: 'ExamRankings',
    label: 'Merit Ranking',
    href: '/portal/exam/rankings'
  }, {
    key: 'ExamPromotions',
    label: 'Promotions',
    href: '/portal/exam/promotions'
  }, {
    key: 'ExamAnalytics',
    label: 'Analytics',
    href: '/portal/exam/analytics'
  }, {
    key: 'ExamAuditLogs',
    label: 'Audit Logs',
    href: '/portal/exam/audit-logs'
  }]
}, {
  key: 'Live Class',
  label: 'Live Class',
  icon: LuPictureInPicture2,
  children: [{
    key: 'Live Class Settings',
    label: 'Live Class Settings',
    href: '/portal/live-class'
  }, {
    key: 'Special Classes Settings',
    label: 'Special Classes Settings',
    href: '/portal/special-classes-setting'
  }]
}, {
  key: 'Educational',
  label: 'Educational',
  icon: LuFileText,
  children: [{
    key: 'Syllabus',
    label: 'Syllabus',
    href: '/portal/syllabus'
  }, {
    key: 'HomeworkMenu',
    label: 'Homework',
    href: '#',
    children: [{
      key: 'HomeworkList',
      label: 'Homework List',
      href: '/portal/homework'
    }, {
      key: 'HomeworkCreate',
      label: 'Create Homework',
      href: '/portal/homework/create',
      permissionAction: 'create'
    }, {
      key: 'HomeworkSubmissions',
      label: 'Submissions',
      href: '/portal/homework/submissions'
    }]
  }, {
    key: 'AssignmentMenu',
    label: 'Assignment',
    href: '#',
    children: [{
      key: 'AssignmentList',
      label: 'Assignment List',
      href: '/portal/assignment'
    }, {
      key: 'AssignmentCreate',
      label: 'Create Assignment',
      href: '/portal/assignment/create',
      permissionAction: 'create'
    }, {
      key: 'AssignmentSubmissions',
      label: 'Submissions',
      href: '/portal/assignment/submissions'
    }]
  }, {
    key: 'Special Classes',
    label: 'Special Classes',
    href: '/portal/special-classes'
  }]
}, {
  key: 'Staff',
  label: 'HR',
  icon: LuSquareUserRound,
  children: [{
    key: 'Departments',
    label: 'Departments',
    href: '/portal/department'
  }, {
    key: 'Designation',
    label: 'Designations',
    href: '/portal/designation'
  }, {
    key: 'Staff List',
    label: 'Staff List',
    href: '/portal/employee'
  }, {
    key: 'Staff Holidays',
    label: 'Staff Holidays',
    href: '/portal/staff-holidays'
  }, {
    key: 'Leave Management',
    label: 'Leave Management',
    href: '#',
    children: [{
      key: 'Employee Leave',
      label: 'Employee Leave',
      href: '/portal/leave-employee'
    }, {
      key: 'Add Leave (Employee)',
      label: 'Add Leave (Employee)',
      href: '/portal/create-leave-employee',
      permissionAction: 'create'
    }, {
      key: 'By Admin',
      label: 'By Admin',
      href: '/portal/leave'
    }, {
      key: 'Add Leave (Admin)',
      label: 'Add Leave (Admin)',
      href: '/portal/create-leave',
      permissionAction: 'create'
    }]
  }, {
    key: 'Staff Attendance',
    label: 'Staff Attendance',
    href: '#',
    children: [{
      key: 'Attendance Entry',
      label: 'Attendance Entry',
      href: '/portal/staff-attendance'
    }, {
      key: 'Attendance Summary',
      label: 'Attendance Summary',
      href: '/portal/staff-attendance-main'
    }]
  }, {
    key: 'Accounts',
    label: 'Accounts',
    href: '#',
    children: [{
      key: 'Estimates',
      label: 'Estimates',
      href: '/portal/sales-estimates'
    }, {
      key: 'Payments',
      label: 'Payments',
      href: '/portal/sales-payments'
    }, {
      key: 'Expenses',
      label: 'Expenses',
      href: '/portal/sales-expenses'
    }]
  }, {
    key: 'Payroll',
    label: 'Payroll',
    href: '#',
    children: [{
      key: 'Staff Salary',
      label: 'Staff Salary',
      href: '/portal/payroll-employee-salary'
    }, {
      key: 'Payslip',
      label: 'Payslip',
      href: '/portal/payroll-payslip'
    }, {
      key: 'Create Payslip',
      label: 'Create Payslip',
      href: '/portal/create-payslip',
      permissionAction: 'create'
    }]
  }]
}, {
  key: 'Settings',
  label: 'Settings',
  icon: LuShieldCheck,
  children: [{
    key: 'MyProfile',
    label: 'My Profile',
    href: '/portal/profile'
  }, {
    key: 'ChangePassword',
    label: 'Change Password',
    href: '/portal/change-password'
  }, {
    key: 'Roles',
    label: 'Roles',
    href: '/portal/roles'
  }]
}];
