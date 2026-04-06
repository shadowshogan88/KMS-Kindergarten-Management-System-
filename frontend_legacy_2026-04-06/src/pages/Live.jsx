import React, { useEffect, useState } from "react";
import Nav from "../components/Nav.jsx";
import { api } from "../utils/api.js";

export default function Live() {
  const [classes, setClasses] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    api
      .get("/live-classes/")
      .then((r) => setClasses(r.data.results ?? r.data))
      .catch(() => setError("Could not load live classes."));
  }, []);

  return (
    <>
      <Nav />
      <div className="container">
        <h2 style={{ marginTop: 14 }}>Live class</h2>
        <div className="card">
          {error ? (
            <div className="error">{error}</div>
          ) : !classes ? (
            <div className="muted">Loading…</div>
          ) : classes.length === 0 ? (
            <div className="muted">No live classes found.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {classes.slice(0, 12).map((c) => (
                <div key={c.id} className="card" style={{ borderColor: "#e2e8f0" }}>
                  <div style={{ fontWeight: 1000 }}>{c.classroom_name} — {c.title}</div>
                  <div className="muted">
                    {new Date(c.starts_at).toLocaleString()} → {new Date(c.ends_at).toLocaleString()}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <a href={c.meet_link || "https://meet.google.com/"} target="_blank" rel="noreferrer">
                      Join Google Meet
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
