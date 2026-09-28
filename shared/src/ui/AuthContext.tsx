// Manages the server-backed cookie session. Only the CSRF proof is browser-readable.

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, apiRaw, AUTH_INVALID_EVENT, CSRF_STORAGE_KEY } from "../api/browserClient";

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
  token: null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: AuthUser, csrfToken?: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const revision = React.useRef(0);

  const clearLocal = useCallback(() => {
    revision.current++;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CSRF_STORAGE_KEY);
    setUser(null);
    setIsLoading(false);
  }, []);
  const logout = useCallback(() => {
    void api("/api/auth/logout", { method: "POST" }).catch(() => {});
    clearLocal();
  }, [clearLocal]);

  useEffect(() => {
    const invalidate = () => clearLocal();
    const synchronize = (event: StorageEvent) => {
      if (event.key !== TOKEN_KEY && event.key !== CSRF_STORAGE_KEY) return;
      if (event.key === CSRF_STORAGE_KEY && event.newValue) return;
      revision.current++;
      setUser(null);
      setIsLoading(false);
    };
    window.addEventListener(AUTH_INVALID_EVENT, invalidate);
    window.addEventListener("storage", synchronize);
    return () => {
      window.removeEventListener(AUTH_INVALID_EVENT, invalidate);
      window.removeEventListener("storage", synchronize);
    };
  }, [clearLocal]);

  // On mount, migrate a legacy bearer token once, then use the HttpOnly session cookie.
  useEffect(() => {
    let cancelled = false;
    const startedAt = revision.current;
    const isCurrent = () => !cancelled && startedAt === revision.current;
    setIsLoading(true);
    const legacyToken = localStorage.getItem(TOKEN_KEY);
    const establish = async () => {
      if (legacyToken) {
        const migrated = await apiRaw<{ csrfToken: string }>("/api/auth/migrate", {
          method: "POST", headers: { Authorization: `Bearer ${legacyToken}` },
        });
        localStorage.setItem(CSRF_STORAGE_KEY, migrated.csrfToken);
        localStorage.removeItem(TOKEN_KEY);
      }
      const current = await apiRaw<AuthUser & { csrfToken?: string }>("/api/auth/me");
      if (current.csrfToken) localStorage.setItem(CSRF_STORAGE_KEY, current.csrfToken);
      return current;
    };
    establish()
      .then((u) => { if (isCurrent()) setUser(u); })
      .catch((e: unknown) => {
        if (!isCurrent()) return;
        const status = typeof e === "object" && e !== null && "status" in e
          ? Number((e as { status?: unknown }).status)
          : null;
        if (status === 401 || status === 403) clearLocal();
      })
      .finally(() => { if (isCurrent()) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [clearLocal]);

  const login = useCallback(async (username: string, password: string) => {
    const startedAt = ++revision.current;
    const data = await apiRaw<{ csrfToken: string; user: AuthUser }>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }).finally(() => { if (startedAt === revision.current) setIsLoading(false); });
    if (startedAt !== revision.current) return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.setItem(CSRF_STORAGE_KEY, data.csrfToken);
    setUser(data.user);
  }, []);

  const updateUser = useCallback((updatedUser: AuthUser, csrfToken?: string) => {
    revision.current++;
    if (csrfToken) localStorage.setItem(CSRF_STORAGE_KEY, csrfToken);
    setUser(updatedUser);
    setIsLoading(false);
  }, []);

  const value = React.useMemo(() => ({ user, token: null as null, isLoading, login, logout, updateUser }),
    [user, isLoading, login, logout, updateUser]);
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
