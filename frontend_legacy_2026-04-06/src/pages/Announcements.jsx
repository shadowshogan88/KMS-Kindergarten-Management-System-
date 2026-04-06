import React, { useEffect, useState } from "react";
import Nav from "../components/Nav.jsx";
import { api } from "../utils/api.js";

export default function Announcements() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    api
      .get("/announcements/")
      .then((r) => setItems(r.data.results ?? r.data))
      .catch(() => setError("Could not load announcements."));
  }, []);

  return (
    <>
      <Nav />
      <div className="container">
        <h2 style={{ marginTop: 14 }}>Announcements</h2>
        <div className="card">
          {error ? (
            <div className="error">{error}</div>
          ) : !items ? (
            <div className="muted">Loading…</div>
          ) : items.length === 0 ? (
            <div className="muted">No announcements.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {items.slice(0, 20).map((a) => (
                <div key={a.id} className="card" style={{ borderColor: "#e2e8f0" }}>
                  <div style={{ fontWeight: 1000 }}>{a.title}</div>
                  <div className="muted" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{a.message}</div>
                  <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                    {a.classroom_name ? `${a.classroom_name} • ` : ""}{new Date(a.created_at).toLocaleString()}
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
