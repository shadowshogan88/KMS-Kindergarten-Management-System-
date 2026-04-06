import React from "react";
import { Route, Routes } from "react-router-dom";
import Protected from "./components/Protected.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Live from "./pages/Live.jsx";
import Announcements from "./pages/Announcements.jsx";
import AdminRoutine from "./pages/AdminRoutine.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />
      <Route
        path="/live"
        element={
          <Protected>
            <Live />
          </Protected>
        }
      />
      <Route
        path="/announcements"
        element={
          <Protected>
            <Announcements />
          </Protected>
        }
      />
      <Route
        path="/admin/routines"
        element={
          <Protected>
            <AdminRoutine />
          </Protected>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <Protected>
            <AdminDashboard />
          </Protected>
        }
      />
    </Routes>
  );
}
