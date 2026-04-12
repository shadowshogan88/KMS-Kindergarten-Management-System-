import React, { useEffect, useMemo, useState } from 'react';
import { LuBriefcase, LuUserCheck, LuUsers, LuUserX } from 'react-icons/lu';
import { apiJson } from '@/utils/api';

const toYmd = d => {
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

const EmployeeReport = () => {
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [presentToday, setPresentToday] = useState(0);
  const [absentToday, setAbsentToday] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const emp = await apiJson('/employees/?page=1&page_size=1');
        setTotalEmployees(Number(emp?.count || 0));
      } catch {
        setTotalEmployees(0);
      }
      try {
        const today = toYmd(new Date());
        const att = await apiJson(`/staff-attendance/?page=1&page_size=500&date=${encodeURIComponent(today)}`);
        const rows = Array.isArray(att?.results) ? att.results : [];
        setPresentToday(rows.filter(r => r.status === 'PRESENT').length);
        setAbsentToday(rows.filter(r => r.status === 'ABSENT').length);
      } catch {
        setPresentToday(0);
        setAbsentToday(0);
      }
    };
    load();
  }, []);

  const reports = useMemo(() => [{
    id: 1,
    title: 'Total Employee',
    value: totalEmployees,
    icon: LuUsers,
    color: 'info'
  }, {
    id: 2,
    title: 'Absent Employee (Today)',
    value: absentToday,
    icon: LuUserX,
    color: 'danger'
  }, {
    id: 3,
    title: 'Present Employee (Today)',
    value: presentToday,
    icon: LuUserCheck,
    color: 'success'
  }, {
    id: 4,
    title: 'Working Days (Current Month)',
    value: '—',
    icon: LuBriefcase,
    color: 'primary'
  }], [totalEmployees, absentToday, presentToday]);

  return <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-5 mb-5">
      {reports.map(({
      id,
      title,
      value,
      icon: Icon,
      color
    }) => <div key={id} className="card">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <div className={`btn text-${color} bg-${color}/10 size-12`}>
                <Icon className="size-6" />
              </div>
              <div>
                <h5 className="mb-1 text-base text-heading font-semibold">
                  <span className="counter-value">{value}</span>
                </h5>
                <p className="text-default-500">{title}</p>
              </div>
            </div>
          </div>
        </div>)}
    </div>;
};
export default EmployeeReport;
