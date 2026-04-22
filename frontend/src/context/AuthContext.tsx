import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// API base: empty string = use Vite proxy (relative paths like /api/...)
const API = '';

interface User {
  id: number;
  email: string;
  username: string;
  twoFAEnabled: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string, twoFAToken?: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      setToken(storedToken);
      fetchUser(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUser = async (authToken: string) => {
    try {
      const response = await fetch(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('authToken');
        setToken(null);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string, twoFAToken?: string) => {
    const response = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, twoFAToken }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Login failed');
    localStorage.setItem('authToken', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (email: string, password: string, username: string) => {
    const response = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Registration failed');
    localStorage.setItem('authToken', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
