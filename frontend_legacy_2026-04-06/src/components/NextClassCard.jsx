import React, { useMemo } from "react";

const DAY_LABEL = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

function jsDayToRoutineDay(jsDay) {
  // JS: 0 Sun ... 6 Sat
  // Routine: 0 Sat ... 6 Fri
  const map = { 6: 0, 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };
  return map[jsDay] ?? 0;
}

function timeToMinutes(t) {
  const [hh, mm] = (t || "00:00").slice(0, 5).split(":").map((x) => Number(x));
  return hh * 60 + mm;
}

export default function NextClassCard({ routines = [] }) {
  const next = useMemo(() => {
    if (!routines.length) return null;
    const now = new Date();
    const routineDay = jsDayToRoutineDay(now.getDay());
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const byDay = new Map();
    for (const r of routines) {
      if (!byDay.has(r.day_of_week)) byDay.set(r.day_of_week, []);
      byDay.get(r.day_of_week).push(r);
    }
    for (const [k, v] of byDay.entries()) {
      v.sort((a, b) => (a.start_time > b.start_time ? 1 : -1));
      byDay.set(k, v);
    }

    // Search today first (skip Friday)
    const searchDays = [];
    for (let i = 0; i < 7; i++) {
      const d = (routineDay + i) % 7;
      if (d === 6) continue; // Friday break
      searchDays.push(d);
    }

    for (const d of searchDays) {
      const list = byDay.get(d) || [];
      if (!list.length) continue;
      if (d === routineDay) {
        const candidates = list.filter((r) => timeToMinutes(r.start_time) >= nowMin);
        if (candidates.length) return { day: d, item: candidates[0] };
      } else {
        return { day: d, item: list[0] };
      }
    }

    return null;
  }, [routines]);

  return (
    <div className="tpl-card">
      <div className="tpl-card-head">
        <div style={{ fontWeight: 1000 }}>Next class</div>
      </div>
      {!next ? (
        <div className="muted">No upcoming routine found.</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
            <div style={{ fontWeight: 1000, color: "#0b4fb8" }}>{DAY_LABEL[next.day]}</div>
            <div style={{ fontWeight: 1000 }}>{next.item.title || "Class"}</div>
          </div>
          <div className="muted" style={{ marginTop: 8, fontWeight: 800 }}>
            {next.item.start_time?.slice(0, 5)}–{next.item.end_time?.slice(0, 5)} • {next.item.teacher_name}
            {next.item.room ? ` • ${next.item.room}` : ""}
          </div>
        </>
      )}
    </div>
  );
}

