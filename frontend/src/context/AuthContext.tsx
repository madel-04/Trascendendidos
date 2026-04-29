// ===== CONTEXTO DE AUTENTICACIÓN =====
// Maneja el estado global del usuario autenticado
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

// URL base de la API
const API = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

// ===== TIPOS =====
interface User {
  id: number;
  email: string;
  username: string;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  twoFAEnabled: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string, twoFAToken?: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  loginWithToken: (authToken: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  setCurrentUser: (nextUser: User | null) => void;
  logout: () => void;
  isLoading: boolean;
}

// ===== CONTEXTO =====
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ===== PROVIDER =====
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar token del localStorage al iniciar
  useEffect(() => {
    const storedToken = localStorage.getItem("authToken");
    if (storedToken) {
      setToken(storedToken);
      fetchUser(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  // Obtener datos del usuario autenticado
  const fetchUser = async (authToken: string) => {
    try {
      const response = await fetch(`${API}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        // Token inválido o expirado
        localStorage.removeItem("authToken");
        setToken(null);
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    if (!token) return;
    await fetchUser(token);
  };

  const loginWithToken = async (authToken: string) => {
    localStorage.setItem("authToken", authToken);
    setToken(authToken);
    await fetchUser(authToken);
  };

  // Login
  const login = async (email: string, password: string, twoFAToken?: string) => {
    const response = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, twoFAToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Error en el login");
    }

    // Guardar token y usuario
    localStorage.setItem("authToken", data.token);
    setToken(data.token);
    setUser(data.user);
  };

  // Registro
  const register = async (email: string, password: string, username: string) => {
    const response = await fetch(`${API}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, username }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Error en el registro");
    }

    // Guardar token y usuario
    localStorage.setItem("authToken", data.token);
    setToken(data.token);
    setUser(data.user);
  };

  // Logout
  const logout = () => {
    localStorage.removeItem("authToken");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, loginWithToken, refreshUser, setCurrentUser: setUser, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

// ===== HOOK PERSONALIZADO =====
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
}
