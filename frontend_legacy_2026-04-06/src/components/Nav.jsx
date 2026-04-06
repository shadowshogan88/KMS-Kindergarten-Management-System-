import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth.jsx";

export default function Nav() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="nav">
      <div className="nav-inner">
        <div className="brand">
          <div className="brand-badge" />
          <div>
            Kindergarten KMS
            <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
              {me ? `${me.username} • ${me.role}` : ""}
            </div>
          </div>
        </div>

        <div className="links">
          <Link to="/">Dashboard</Link>
          <Link to="/live">Live Class</Link>
          <Link to="/announcements">Announcements</Link>
          {me?.role === "ADMIN" ? <Link to="/admin/dashboard">Admin</Link> : null}
          <button
            className="secondary"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
