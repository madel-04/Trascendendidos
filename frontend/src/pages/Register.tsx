// ===== PÁGINA DE REGISTRO =====
import { useState, FormEvent, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { evaluatePasswordStrength } from "../utils/passwordStrength";

function getPasswordSecurityError(password: string, email: string, username: string): string | null {
  if (password.length < 12) return "La contraseña debe tener al menos 12 caracteres";
  if (!/[A-Z]/.test(password)) return "Incluye al menos una letra mayúscula";
  if (!/[a-z]/.test(password)) return "Incluye al menos una letra minúscula";
  if (!/\d/.test(password)) return "Incluye al menos un número";
  if (!/[^A-Za-z0-9]/.test(password)) return "Incluye al menos un carácter especial";
  if (/\s/.test(password)) return "No uses espacios en la contraseña";

  const lowered = password.toLowerCase();
  if (username.trim().length >= 3 && lowered.includes(username.trim().toLowerCase())) {
    return "La contraseña no debe contener tu username";
  }

  const localEmail = email.split("@")[0]?.trim().toLowerCase();
  if (localEmail && localEmail.length >= 3 && lowered.includes(localEmail)) {
    return "La contraseña no debe contener tu email";
  }

  return null;
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordStrength = useMemo(
    () => evaluatePasswordStrength(password, { email, username }),
    [password, email, username]
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    // Validaciones básicas
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 12 caracteres");
      return;
    }

    const passwordError = getPasswordSecurityError(password, email, username);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);

    try {
      await register(email, password, username);
      navigate("/play"); // Redirigir al juego tras registro exitoso
    } catch (err: any) {
      setError(err.message || "Error en el registro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h1 className="page-title">Create Account</h1>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-field">
          <label className="auth-label" htmlFor="username">
            Username
          </label>
          <input
            className="auth-input"
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={50}
          />
        </div>

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
            minLength={12}
          />

          <div className="password-meter">
            <div className="password-meter-track">
              <div
                className={`password-meter-fill ${passwordStrength.level}`}
                style={{ width: `${(passwordStrength.score / passwordStrength.rules.length) * 100}%` }}
              />
            </div>
            <div className="password-meter-label">
              Fortaleza: {passwordStrength.level === "strong" ? "Fuerte" : passwordStrength.level === "medium" ? "Media" : "Debil"}
            </div>
            <ul className="password-rules">
              {passwordStrength.rules.map((rule) => (
                <li key={rule.key} className={`password-rule ${rule.passed ? "ok" : ""}`}>
                  {rule.passed ? "OK" : "-"} {rule.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="confirmPassword">
            Confirm Password
          </label>
          <input
            className="auth-input"
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <div className="auth-error">{error}</div>
        )}

        <button
          className="btn btn-primary"
          type="submit"
          disabled={loading}
        >
          {loading ? "Loading..." : "Register"}
        </button>
      </form>

      <p className="auth-linkline">
        Already have an account? <Link to="/login">Login here</Link>
      </p>
    </div>
  );
}
