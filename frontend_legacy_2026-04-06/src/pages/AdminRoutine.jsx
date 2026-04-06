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

function toTimeInput(value) {
  if (!value) return "";
  return value.slice(0, 5);
}

export default function AdminRoutine() {
  const [classrooms, setClassrooms] = useState(null);
  const [teachers, setTeachers] = useState(null);
  const [classroomId, setClassroomId] = useState("");
  const [routines, setRoutines] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    id: null,
    day_of_week: 0,
    teacher: "",
    start_time: "09:00",
    end_time: "09:40",
    title: "",
    room: ""
  });

  useEffect(() => {
    setError("");
    Promise.all([api.get("/classrooms/"), api.get("/users/teachers/")])
      .then(([c, t]) => {
        const cList = c.data.results ?? c.data;
        setClassrooms(cList);
        setTeachers(t.data);
        if (cList.length) setClassroomId(String(cList[0].id));
      })
      .catch(() => setError("Could not load classrooms/teachers. Make sure you are logged in as ADMIN."));
  }, []);

  function loadRoutines(cid) {
    if (!cid) return;
    setRoutines(null);
    setError("");
    api
      .get(`/routines/?classroom=${cid}`)
      .then((r) => setRoutines(r.data.results ?? r.data))
      .catch((e) => setError(`Could not load routines (HTTP ${e?.response?.status || "?"}).`));
  }

  useEffect(() => {
    loadRoutines(classroomId);
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

  async function submit(e) {
    e.preventDefault();
    if (!classroomId) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        classroom: Number(classroomId),
        teacher: Number(form.teacher),
        day_of_week: Number(form.day_of_week),
        start_time: form.start_time,
        end_time: form.end_time,
        title: form.title,
        room: form.room
      };
      if (form.id) await api.patch(`/routines/${form.id}/`, payload);
      else await api.post("/routines/", payload);

      setForm((f) => ({ ...f, id: null }));
      loadRoutines(classroomId);
    } catch (err) {
      const msg = err?.response?.data;
      setError(typeof msg === "string" ? msg : "Save failed. Check overlap/time and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm("Delete this routine?")) return;
    setSaving(true);
    setError("");
    try {
      await api.delete(`/routines/${id}/`);
      if (form.id === id) setForm((f) => ({ ...f, id: null }));
      loadRoutines(classroomId);
    } catch {
      setError("Delete failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SchoolShell
      title="Timetable"
      requireAdmin
      rightPanel={
        <>
          <CalendarCard />
          <NextClassCard routines={routines || []} />
          <div className="tpl-card">
            <div style={{ fontWeight: 1000, marginBottom: 6 }}>Weekly rules</div>
            <div className="muted" style={{ fontWeight: 800 }}>
              Schedule runs Sat–Thu. Friday is break (no routine allowed).
            </div>
          </div>
        </>
      }
    >
      <div className="tpl-card">
        <div className="tpl-card-head">
          <div>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>Timetable</div>
            <div className="muted" style={{ fontWeight: 800 }}>Create, edit, delete weekly routines</div>
          </div>
          <div className="tpl-tabs" aria-label="view mode">
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
            <div className="muted" style={{ fontWeight: 900, marginBottom: 6 }}>Quick add</div>
            <div className="pill">Click a slot to edit • Overlap blocked</div>
          </div>
        </div>

        <form onSubmit={submit} className="tpl-card" style={{ borderColor: "#e2e8f0", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontWeight: 1000 }}>{form.id ? "Edit routine" : "New routine"}</div>
            {form.id ? (
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setForm({ id: null, day_of_week: 0, teacher: "", start_time: "09:00", end_time: "09:40", title: "", room: "" })
                }
                disabled={saving}
              >
                Cancel
              </button>
            ) : null}
          </div>

          <div className="grid" style={{ marginTop: 10 }}>
            <div className="col-6">
              <div className="muted" style={{ fontWeight: 900, marginBottom: 6 }}>Day</div>
              <select value={String(form.day_of_week)} onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}>
                {DAYS.map((d) => (
                  <option key={d.value} value={String(d.value)}>{d.label}</option>
                ))}
              </select>
            </div>

            <div className="col-6">
              <div className="muted" style={{ fontWeight: 900, marginBottom: 6 }}>Teacher</div>
              <select value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })} disabled={!teachers} required>
                <option value="">Select teacher</option>
                {(teachers || []).map((t) => (
                  <option key={t.id} value={String(t.id)}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="col-6">
              <div className="muted" style={{ fontWeight: 900, marginBottom: 6 }}>Start</div>
              <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
            </div>

            <div className="col-6">
              <div className="muted" style={{ fontWeight: 900, marginBottom: 6 }}>End</div>
              <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
            </div>

            <div className="col-6">
              <div className="muted" style={{ fontWeight: 900, marginBottom: 6 }}>Title</div>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Math / Reading / Drawing" />
            </div>

            <div className="col-6">
              <div className="muted" style={{ fontWeight: 900, marginBottom: 6 }}>Room</div>
              <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="Room 201" />
            </div>

            <div className="col-12 row" style={{ justifyContent: "flex-end" }}>
              <button disabled={saving} type="submit">{saving ? "Saving..." : form.id ? "Update" : "Add routine"}</button>
            </div>
          </div>
        </form>

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
                  <div
                    key={rt.id}
                    className="tpl-slot"
                    onClick={() =>
                      setForm({
                        id: rt.id,
                        day_of_week: rt.day_of_week,
                        teacher: String(rt.teacher),
                        start_time: toTimeInput(rt.start_time),
                        end_time: toTimeInput(rt.end_time),
                        title: rt.title || "",
                        room: rt.room || ""
                      })
                    }
                  >
                    <div className="tpl-slot-time">{rt.start_time.slice(0, 5)}–{rt.end_time.slice(0, 5)}</div>
                    <div className="tpl-slot-title">{rt.title || "Class"}</div>
                    <div className="tpl-slot-meta">{rt.teacher_name}{rt.room ? ` • ${rt.room}` : ""}</div>
                    <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
                      <button
                        type="button"
                        className="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(rt.id);
                        }}
                        disabled={saving}
                      >
                        Delete
                      </button>
                    </div>
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
