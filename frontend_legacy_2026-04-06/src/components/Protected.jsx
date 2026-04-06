import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../state/auth.jsx";

export default function Protected({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

