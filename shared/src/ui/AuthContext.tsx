// Manages JWT auth state. Token is persisted in localStorage.

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiRaw } from "../api/browserClient";

const TOKEN_KEY = "beholden_token";

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  isAdmin: boolean;
  hasDmAccess: boolean;
  textScale: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: AuthUser, newToken: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const revision = React.useRef(0);

  const logout = useCallback(() => {
    revision.current++;
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setIsLoading(false);
  }, []);

  // On mount (or when token changes), verify token by calling /api/auth/me.
  useEffect(() => {
    let cancelled = false;
    const startedAt = revision.current;
    const isCurrent = () => !cancelled && startedAt === revision.current;
    if (!token) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    apiRaw<AuthUser>("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((u) => { if (isCurrent()) setUser(u); })
      .catch((e: unknown) => {
        if (!isCurrent()) return;
        const status = typeof e === "object" && e !== null && "status" in e
          ? Number((e as { status?: unknown }).status)
          : null;
        if (status === 401 || status === 403) logout();
      })
      .finally(() => { if (isCurrent()) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [token, logout]);

  const login = useCallback(async (username: string, password: string) => {
    const startedAt = ++revision.current;
    const data = await apiRaw<{ token: string; user: AuthUser }>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }).finally(() => { if (startedAt === revision.current) setIsLoading(false); });
    if (startedAt !== revision.current) return;
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const updateUser = useCallback((updatedUser: AuthUser, newToken: string) => {
    revision.current++;
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(updatedUser);
    setIsLoading(false);
  }, []);

  const value = React.useMemo(() => ({ user, token, isLoading, login, logout, updateUser }),
    [user, token, isLoading, login, logout, updateUser]);
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
