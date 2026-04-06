import React, { useMemo, useState } from "react";

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export default function CalendarCard() {
  const [cursor, setCursor] = useState(() => new Date());
  const today = new Date();

  const grid = useMemo(() => {
    const first = startOfMonth(cursor);
    const last = endOfMonth(cursor);
    const startDow = first.getDay(); // 0 Sun

    const days = [];
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));

    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [cursor]);

  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="tpl-card">
      <div className="tpl-card-head">
        <div style={{ fontWeight: 1000 }}>{monthLabel}</div>
        <div className="row">
          <button className="tpl-iconbtn" onClick={() => setCursor(addMonths(cursor, -1))} type="button">‹</button>
          <button className="tpl-iconbtn" onClick={() => setCursor(addMonths(cursor, 1))} type="button">›</button>
        </div>
      </div>

      <div className="tpl-cal">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="tpl-cal-dow">{d}</div>
        ))}
        {grid.map((d, idx) => {
          const isToday =
            d &&
            d.getFullYear() === today.getFullYear() &&
            d.getMonth() === today.getMonth() &&
            d.getDate() === today.getDate();
          return (
            <div key={idx} className={`tpl-cal-day ${isToday ? "today" : ""}`}>
              {d ? d.getDate() : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

