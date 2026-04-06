import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth.jsx";

function IconBox({ children }) {
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        border: "2px solid rgba(255,255,255,0.25)",
        display: "grid",
        placeItems: "center",
        fontWeight: 1000
      }}
    >
      {children}
    </div>
  );
}

export default function SchoolShell({ title, children, rightPanel, requireAdmin = false }) {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (requireAdmin && me && me.role !== "ADMIN") navigate("/", { replace: true });
  }, [requireAdmin, me, navigate]);

  const menu = useMemo(
    () => [
      { to: "/admin/dashboard", label: "Dashboard" },
      { to: "/admin/routines", label: "Timetable" },
      { to: "/live", label: "Live class" },
      { to: "/announcements", label: "Announcements" }
    ],
    []
  );

  return (
    <div className="tpl">
      <aside className="tpl-side">
        <div className="tpl-side-top">
          <div className="tpl-logo">
            <div className="tpl-logo-box">M</div>
          </div>
        </div>

        <nav className="tpl-nav">
          {menu.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              className={({ isActive }) => `tpl-link ${isActive ? "active" : ""}`}
            >
              {m.label}
            </NavLink>
          ))}
        </nav>

        <div className="tpl-side-bottom">
          <div className="tpl-user">
            <div className="tpl-avatar">{(me?.username || "U").slice(0, 1).toUpperCase()}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 1000, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {me?.username || "—"}
              </div>
              <div className="tpl-muted">{me?.role || ""}</div>
            </div>
          </div>
          <button
            className="tpl-logout"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      <div className="tpl-main">
        <header className="tpl-topbar">
          <div className="tpl-school">
            <div style={{ fontWeight: 1000 }}>ABC School</div>
            <div className="tpl-muted" style={{ marginLeft: 10 }}>{title}</div>
          </div>

          <div className="tpl-search">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search students, teachers, discipline..."
            />
            <button type="button" className="tpl-search-btn" onClick={() => setQ("")}>
              Search
            </button>
          </div>

          <div className="tpl-icons">
            <IconBox>?</IconBox>
            <IconBox>⋯</IconBox>
            <div className="tpl-avatar small">{(me?.username || "U").slice(0, 1).toUpperCase()}</div>
          </div>
        </header>

        <div className="tpl-body">
          <section className="tpl-content">{children}</section>
          <aside className="tpl-right">{rightPanel}</aside>
        </div>
      </div>
    </div>
  );
}

