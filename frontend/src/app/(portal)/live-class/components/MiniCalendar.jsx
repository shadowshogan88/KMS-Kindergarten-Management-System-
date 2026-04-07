import { useMemo } from 'react';

const pad2 = n => String(n).padStart(2, '0');

const toDateStr = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const monthLabel = d =>
  d.toLocaleString(undefined, { month: 'long', year: 'numeric' });

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MiniCalendar = ({ month, items, selectedDate, onMonthChange, onDateSelect, hidePastBadges = false }) => {
  const eventCountByDate = useMemo(() => {
    const map = new Map();
    for (const ev of items || []) {
      const key = ev?.date;
      if (!key) continue;
      if (ev?.is_holiday) continue;
      const inc = typeof ev?.count === 'number' ? ev.count : 1;
      map.set(key, (map.get(key) || 0) + inc);
    }
    return map;
  }, [items]);

  const holidayByDate = useMemo(() => {
    const set = new Set();
    for (const ev of items || []) {
      const key = ev?.date;
      if (!key) continue;
      if (ev?.is_holiday) set.add(key);
    }
    return set;
  }, [items]);

  const cells = useMemo(() => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(year, m, 1);
    const daysInMonth = new Date(year, m + 1, 0).getDate();

    // Monday-based offset
    const jsDay = first.getDay(); // Sun=0..Sat=6
    const offset = (jsDay + 6) % 7; // Mon=0..Sun=6

    const out = [];
    for (let i = 0; i < offset; i++) out.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      out.push(new Date(year, m, day));
    }
    while (out.length % 7 !== 0) out.push(null);
    // keep 6 rows
    while (out.length < 42) out.push(null);
    return out;
  }, [month]);

  const todayStr = toDateStr(new Date());

  return (
    <div className="rounded-lg border border-default-200 bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-default-200 flex items-center justify-between gap-2">
        <div className="font-semibold text-default-800">{monthLabel(month)}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-sm bg-default-200 hover:bg-default-300 text-default-700"
            onClick={() => onMonthChange?.(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            Prev
          </button>
          <button
            type="button"
            className="btn btn-sm bg-default-200 hover:bg-default-300 text-default-700"
            onClick={() => onMonthChange?.(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            Next
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-7 gap-2 text-xs text-default-500 mb-2">
          {weekDays.map(d => (
            <div key={d} className="text-center">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {cells.map((d, idx) => {
            if (!d) return <div key={idx} className="h-9" />;
            const dateStr = toDateStr(d);
            const isSelected = selectedDate === dateStr;
            const isToday = todayStr === dateStr;
            const isPast = dateStr < todayStr;
            const count = eventCountByDate.get(dateStr) || 0;
            const isHoliday = holidayByDate.has(dateStr);

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => onDateSelect?.(dateStr)}
                className={[
                  'h-9 rounded-md border text-sm flex items-center justify-center relative',
                  isHoliday
                    ? 'border-warning bg-warning/10 text-warning hover:bg-warning/15'
                    : isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-default-200 hover:bg-default-150',
                  isToday && !isSelected ? 'ring-1 ring-primary/30' : '',
                ].join(' ')}
              >
                {d.getDate()}
                {count && (!hidePastBadges || !isPast) ? (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-primary text-white text-[10px] flex items-center justify-center">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MiniCalendar;

