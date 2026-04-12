import React from 'react';
import { LuClock, LuOctagonX, LuRefreshCw } from 'react-icons/lu';
import { useMemo } from 'react';
import { useStaffAttendance } from '../attendanceContext';
const EmployeeWorkDetails = () => {
  const { records } = useStaffAttendance();
  const stats = useMemo(() => {
    const present = records.filter(r => r.status === 'PRESENT').length;
    const absent = records.filter(r => r.status === 'ABSENT').length;
    const leave = records.filter(r => r.status === 'LEAVE').length;
    return { present, absent, leave };
  }, [records]);

  const workDetails = [{
    id: 1,
    value: stats.present,
    label: 'Present Days',
    icon: LuClock,
    textColor: 'text-info',
    bgColor: 'bg-info/10'
  }, {
    id: 2,
    value: stats.absent,
    label: 'Absent Days',
    icon: LuOctagonX,
    textColor: 'text-danger',
    bgColor: 'bg-danger/10'
  }, {
    id: 3,
    value: stats.leave,
    label: 'Leave Days',
    icon: LuRefreshCw,
    textColor: 'text-warning',
    bgColor: 'bg-warning/10'
  }];

  return <div className="grid lg:grid-cols-3 grid-cols-1 gap-5 mb-5">
      {workDetails.map(detail => {
      const Icon = detail.icon;
      return <div className="card" key={detail.id}>
            <div className="card-body">
              <div className="flex items-center gap-3">
                <div className={`btn ${detail.textColor} ${detail.bgColor} size-12`}>
                  <Icon className="size-6" />
                </div>
                <div>
                  <h5 className="mb-1 text-base text-heading font-semibold">
                    <span className="counter-value">{detail.value}</span>
                  </h5>
                  <p className="text-default-500">{detail.label}</p>
                </div>
              </div>
            </div>
          </div>;
    })}
    </div>;
};
export default EmployeeWorkDetails;
