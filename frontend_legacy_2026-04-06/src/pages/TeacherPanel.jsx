import React, { useEffect, useState } from "react";
import { api } from "../utils/api.js";

export default function TeacherPanel() {
  const [classrooms, setClassrooms] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    api
      .get("/classrooms/")
      .then((r) => setClassrooms(r.data.results ?? r.data))
      .catch(() => setError("Could not load classrooms."));
  }, []);

  return (
    <div className="card">
      <div style={{ fontWeight: 1000, marginBottom: 10 }}>Teacher tools</div>
      {error ? (
        <div className="error">{error}</div>
      ) : !classrooms ? (
        <div className="muted">Loading classrooms…</div>
      ) : classrooms.length === 0 ? (
        <div className="muted">No classroom assigned yet.</div>
      ) : (
        <div className="muted">
          Your classroom(s): {classrooms.map((c) => c.name).join(", ")}. Use Admin panel or API to take attendance and add daily reports.
        </div>
      )}
    </div>
  );
}
