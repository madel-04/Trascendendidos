// ===== PÁGINA DE LOGIN =====
import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFAToken, setTwoFAToken] = useState("");
  const [requires2FA, setRequires2FA] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password, twoFAToken || undefined);
      navigate("/play"); // Redirigir al juego tras login exitoso
    } catch (err: any) {
      // Si requiere 2FA, mostrar campo para el código
      if (err.message.includes("2FA")) {
        setRequires2FA(true);
        setError("Ingresa tu código 2FA");
      } else {
        setError(err.message || "Error en el login");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h1 className="page-title">Login</h1>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-field">
          <label className="auth-label" htmlFor="email">
            Email
          </label>
          <input
            className="auth-input"
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="password">
            Password
          </label>
          <input
            className="auth-input"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {requires2FA && (
          <div className="auth-field">
            <label className="auth-label" htmlFor="twoFAToken">
              2FA Code (6 digits)
            </label>
            <input
              className="auth-input"
              id="twoFAToken"
              type="text"
              value={twoFAToken}
              onChange={(e) => setTwoFAToken(e.target.value)}
              placeholder="000000"
              maxLength={6}
              style={{ textAlign: "center", letterSpacing: "0.3em" }}
            />
          </div>
        )}

        {error && (
          <div className="auth-error">{error}</div>
        )}

        <button
          className="btn btn-primary"
          type="submit"
          disabled={loading}
        >
          {loading ? "Loading..." : "Login"}
        </button>
      </form>

      <p className="auth-linkline">
        Don&apos;t have an account? <Link to="/register">Register here</Link>
      </p>
    </div>
  );
}
