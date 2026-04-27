import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { api } from "../api/client";
import { AdminUser } from "../types";

interface AuthContextValue {
  admin?: AdminUser;
  token?: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | undefined>(() => localStorage.getItem("akk_token") ?? undefined);
  const [admin, setAdmin] = useState<AdminUser | undefined>(() => {
    const raw = localStorage.getItem("akk_admin");
    return raw ? (JSON.parse(raw) as AdminUser) : undefined;
  });

  async function login(email: string, password: string) {
    const { data } = await api.post("/admin/auth/login", { email, password });
    localStorage.setItem("akk_token", data.token);
    localStorage.setItem("akk_admin", JSON.stringify(data.admin));
    setToken(data.token);
    setAdmin(data.admin);
  }

  function logout() {
    localStorage.removeItem("akk_token");
    localStorage.removeItem("akk_admin");
    setToken(undefined);
    setAdmin(undefined);
  }

  const value = useMemo(() => ({ admin, token, login, logout }), [admin, token]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider bulunamadı.");
  return value;
}
