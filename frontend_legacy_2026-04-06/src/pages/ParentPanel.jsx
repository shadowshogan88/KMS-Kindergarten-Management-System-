import React, { useEffect, useState } from "react";
import { api } from "../utils/api.js";

export default function ParentPanel() {
  const [students, setStudents] = useState(null);
  const [selected, setSelected] = useState("");
  const [reports, setReports] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    api
      .get("/students/")
      .then((r) => {
        const list = r.data.results ?? r.data;
        setStudents(list);
        if (list.length) setSelected(String(list[0].id));
      })
      .catch(() => setError("Could not load children."));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setReports(null);
    setAttendance(null);
    api
      .get(`/daily-reports/?student=${selected}`)
      .then((r) => setReports(r.data.results ?? r.data))
      .catch(() => setReports([]));
    api
      .get(`/attendance/?student=${selected}`)
      .then((r) => setAttendance(r.data.results ?? r.data))
      .catch(() => setAttendance([]));
  }, [selected]);

  return (
    <div className="card">
      <div style={{ fontWeight: 1000, marginBottom: 10 }}>Parent dashboard</div>

      {error ? (
        <div className="error">{error}</div>
      ) : !students ? (
        <div className="muted">Loading children…</div>
      ) : students.length === 0 ? (
        <div className="muted">No child linked to this parent.</div>
      ) : (
        <>
          <div className="grid">
            <div className="col-6">
              <div className="muted" style={{ fontWeight: 900, marginBottom: 6 }}>Select child</div>
              <select value={selected} onChange={(e) => setSelected(e.target.value)}>
                {students.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.first_name} {s.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6">
              <div className="muted" style={{ fontWeight: 900, marginBottom: 6 }}>Quick links</div>
              <div className="muted">Daily activity + attendance shown below.</div>
            </div>
          </div>

          <hr style={{ border: 0, borderTop: "2px dashed #fde68a", margin: "14px 0" }} />

          <div className="grid">
            <div className="col-6">
              <div style={{ fontWeight: 1000, marginBottom: 8 }}>Daily activity</div>
              {!reports ? (
                <div className="muted">Loading…</div>
              ) : reports.length === 0 ? (
                <div className="muted">No reports yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {reports.slice(0, 5).map((r) => (
                    <div key={r.id} className="card" style={{ borderColor: "#e2e8f0" }}>
                      <div style={{ fontWeight: 1000 }}>{new Date(r.date).toLocaleDateString()} • {r.mood}</div>
                      <div className="muted" style={{ marginTop: 6 }}><b>Food:</b> {r.food || "—"}</div>
                      <div className="muted"><b>Sleep:</b> {r.sleep || "—"}</div>
                      <div className="muted"><b>Learning:</b> {r.learning || "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="col-6">
              <div style={{ fontWeight: 1000, marginBottom: 8 }}>Attendance</div>
              {!attendance ? (
                <div className="muted">Loading…</div>
              ) : attendance.length === 0 ? (
                <div className="muted">No attendance records yet.</div>
              ) : (
                <ul style={{ margin: 0 }}>
                  {attendance.slice(0, 8).map((a) => (
                    <li key={a.id} style={{ marginBottom: 6 }}>
                      <span style={{ fontWeight: 1000 }}>{new Date(a.date).toLocaleDateString()}</span> — {a.status}{" "}
                      <span className="muted">{a.note ? `(${a.note})` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
