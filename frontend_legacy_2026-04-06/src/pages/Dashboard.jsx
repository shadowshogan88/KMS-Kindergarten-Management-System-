import React, { useEffect, useState } from "react";
import Nav from "../components/Nav.jsx";
import { api } from "../utils/api.js";
import TeacherPanel from "./TeacherPanel.jsx";
import ParentPanel from "./ParentPanel.jsx";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    api
      .get("/dashboard/")
      .then((r) => setData(r.data))
      .catch((err) => {
        const status = err?.response?.status;
        const baseUrl = api?.defaults?.baseURL;
        setError(
          `Dashboard load failed${status ? ` (HTTP ${status})` : ""}. Backend: ${baseUrl || "(unknown)"}`
        );
      });
  }, []);

  return (
    <>
      <Nav />
      <div className="container">
        <h2 style={{ marginTop: 14 }}>Dashboard</h2>
        <div className="grid">
          <div className="card col-12">
            {error ? (
              <div className="error">{error}</div>
            ) : !data ? (
              <div className="muted">Loading…</div>
            ) : (
              <div className="grid">
                {Object.entries(data.counts).map(([k, v]) => (
                  <div key={k} className="card col-6" style={{ borderColor: "#e2e8f0" }}>
                    <div className="muted" style={{ fontWeight: 900 }}>{k.replaceAll("_", " ")}</div>
                    <div style={{ fontSize: 28, fontWeight: 1000 }}>{String(v)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card col-12">
            <div style={{ fontWeight: 1000, marginBottom: 10 }}>Upcoming live classes</div>
            {error ? (
              <div className="muted">—</div>
            ) : !data ? (
              <div className="muted">Loading…</div>
            ) : data.upcoming_live_classes.length === 0 ? (
              <div className="muted">No upcoming live classes.</div>
            ) : (
              <ul style={{ margin: 0 }}>
                {data.upcoming_live_classes.map((c) => (
                  <li key={c.id} style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 900 }}>{c.classroom__name}</span> — {c.title}{" "}
                    <span className="muted">({new Date(c.starts_at).toLocaleString()})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="col-12">
            {!data ? null : data.role === "TEACHER" ? <TeacherPanel /> : data.role === "PARENT" ? <ParentPanel /> : (
              <div className="card">
                <div style={{ fontWeight: 1000 }}>Admin tip</div>
                <div className="muted">Use Django Admin to manage users, students, classes, reports, and announcements.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
