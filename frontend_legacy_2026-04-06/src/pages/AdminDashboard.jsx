import React, { useEffect, useMemo, useState } from "react";
import SchoolShell from "../components/SchoolShell.jsx";
import CalendarCard from "../components/CalendarCard.jsx";
import NextClassCard from "../components/NextClassCard.jsx";
import { api } from "../utils/api.js";

const DAYS = [
  { value: 0, label: "Sat" },
  { value: 1, label: "Sun" },
  { value: 2, label: "Mon" },
  { value: 3, label: "Tue" },
  { value: 4, label: "Wed" },
  { value: 5, label: "Thu" }
];

export default function AdminDashboard() {
  const [classrooms, setClassrooms] = useState(null);
  const [classroomId, setClassroomId] = useState("");
  const [routines, setRoutines] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    api
      .get("/classrooms/")
      .then((r) => {
        const list = r.data.results ?? r.data;
        setClassrooms(list);
        if (list.length) setClassroomId(String(list[0].id));
      })
      .catch(() => setError("Could not load classrooms."));
  }, []);

  useEffect(() => {
    if (!classroomId) return;
    setRoutines(null);
    setError("");
    api
      .get(`/routines/?classroom=${classroomId}`)
      .then((r) => setRoutines(r.data.results ?? r.data))
      .catch(() => setError("Could not load routines."));
  }, [classroomId]);

  const byDay = useMemo(() => {
    const map = new Map(DAYS.map((d) => [d.value, []]));
    (routines || []).forEach((rt) => {
      if (map.has(rt.day_of_week)) map.get(rt.day_of_week).push(rt);
    });
    for (const [k, v] of map.entries()) {
      v.sort((a, b) => (a.start_time > b.start_time ? 1 : -1));
      map.set(k, v);
    }
    return map;
  }, [routines]);

  return (
    <SchoolShell
      title="Dashboard"
      requireAdmin
      rightPanel={
        <>
          <CalendarCard />
          <NextClassCard routines={routines || []} />
        </>
      }
    >
      <div className="tpl-card">
        <div className="tpl-card-head">
          <div>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>Timetable</div>
            <div className="muted" style={{ fontWeight: 800 }}>Week view (Sat–Thu)</div>
          </div>
          <div className="tpl-tabs">
            <button type="button" className="tpl-tab">Day</button>
            <button type="button" className="tpl-tab active">Week</button>
            <button type="button" className="tpl-tab">Month</button>
          </div>
        </div>

        {error ? <div className="error" style={{ marginBottom: 10 }}>{error}</div> : null}

        <div className="grid" style={{ marginBottom: 12 }}>
          <div className="col-6">
            <div className="muted" style={{ fontWeight: 900, marginBottom: 6 }}>Class</div>
            <select value={classroomId} onChange={(e) => setClassroomId(e.target.value)} disabled={!classrooms}>
              {(classrooms || []).map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="col-6">
            <div className="muted" style={{ fontWeight: 900, marginBottom: 6 }}>Friday</div>
            <div className="pill">Break day</div>
          </div>
        </div>

        <div className="tpl-timetable">
          {DAYS.map((d) => (
            <div key={d.value} className="tpl-day">
              <div className="tpl-dayhead">
                <div className="tpl-dayname">{d.label}</div>
                <div className="tpl-daydate">{(byDay.get(d.value) || []).length} slots</div>
              </div>
              {(byDay.get(d.value) || []).length === 0 ? (
                <div className="muted">No classes</div>
              ) : (
                (byDay.get(d.value) || []).map((rt) => (
                  <div key={rt.id} className="tpl-slot">
                    <div className="tpl-slot-time">{rt.start_time.slice(0, 5)}–{rt.end_time.slice(0, 5)}</div>
                    <div className="tpl-slot-title">{rt.title || "Class"}</div>
                    <div className="tpl-slot-meta">{rt.teacher_name}{rt.room ? ` • ${rt.room}` : ""}</div>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </div>
    </SchoolShell>
  );
}

