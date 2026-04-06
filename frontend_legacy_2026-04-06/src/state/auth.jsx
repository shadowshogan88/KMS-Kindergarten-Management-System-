import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, setAccessToken } from "../utils/api.js";

const AuthContext = createContext(null);

function storedToken() {
  return localStorage.getItem("kms_access_token") || "";
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(storedToken());
  const [me, setMe] = useState(null);

  useEffect(() => {
    setAccessToken(token);
    if (!token) {
      setMe(null);
      return;
    }
    api.get("/auth/me/").then((r) => setMe(r.data)).catch(() => setMe(null));
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      me,
      isAuthenticated: Boolean(token),
      setToken: (t) => {
        if (t) localStorage.setItem("kms_access_token", t);
        else localStorage.removeItem("kms_access_token");
        setToken(t || "");
      },
      logout: () => {
        localStorage.removeItem("kms_access_token");
        setToken("");
      }
    }),
    [token, me]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

