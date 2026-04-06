import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api.js";
import { useAuth } from "../state/auth.jsx";

export default function Login() {
  const [username, setUsername] = useState("parent");
  const [password, setPassword] = useState("parent1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setToken } = useAuth();
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/token/", { username, password });
      setToken(res.data.access);
      navigate("/", { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const baseUrl = api?.defaults?.baseURL;
      setError(`Login failed${status ? ` (HTTP ${status})` : ""}. Backend: ${baseUrl || "(unknown)"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <h2 style={{ marginTop: 10 }}>Welcome back</h2>
      <div className="card">
        <div className="pill" style={{ marginBottom: 12 }}>
          Demo users: admin / teacher / parent
        </div>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 12 }}>
            <div className="muted" style={{ fontWeight: 900 }}>Username</div>
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div className="muted" style={{ fontWeight: 900 }}>Password</div>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}
          <button disabled={loading} type="submit">{loading ? "Signing in..." : "Sign in"}</button>
        </form>
      </div>
    </div>
  );
}
