import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { evaluatePasswordStrength } from "../utils/passwordStrength";

function getPasswordSecurityError(password: string, email: string, username: string): string | null {
  if (password.length < 12) return "La contrasena debe tener al menos 12 caracteres";
  if (!/[A-Z]/.test(password)) return "Incluye al menos una letra mayuscula";
  if (!/[a-z]/.test(password)) return "Incluye al menos una letra minuscula";
  if (!/\d/.test(password)) return "Incluye al menos un numero";
  if (!/[^A-Za-z0-9]/.test(password)) return "Incluye al menos un caracter especial";
  if (/\s/.test(password)) return "No uses espacios en la contrasena";

  const lowered = password.toLowerCase();
  if (username.trim().length >= 3 && lowered.includes(username.trim().toLowerCase())) {
    return "La contrasena no debe contener tu username";
  }

  const localEmail = email.split("@")[0]?.trim().toLowerCase();
  if (localEmail && localEmail.length >= 3 && lowered.includes(localEmail)) {
    return "La contrasena no debe contener tu email";
  }

  return null;
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const timeoutRef = useRef<number | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [leavingTarget, setLeavingTarget] = useState<"/login" | null>(null);

  const passwordStrength = useMemo(
    () => evaluatePasswordStrength(password, { email, username }),
    [password, email, username]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleSoftNavigate = (target: "/login") => {
    if (leavingTarget) return;
    setLeavingTarget(target);
    timeoutRef.current = window.setTimeout(() => navigate(target), 420);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Las contrasenas no coinciden");
      return;
    }

    if (password.length < 12) {
      setError("La contrasena debe tener al menos 12 caracteres");
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
      navigate("/play");
    } catch (err: any) {
      setError(err.message || "Error en el registro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container play-route-shell play-route-shell-center">
      <div className={`glass-panel play-hub-panel play-hub-panel-enter auth-hub-panel${leavingTarget ? " auth-hub-panel-leaving" : ""}`}>
        <div className="auth-hub-inner">
          <div className="auth-hub-copy">
            <div className="main-menu-kicker">PERFIL NEON</div>
            <h1 className="title-glow auth-hub-title">REGISTRARSE</h1>
            <p className="auth-hub-subtitle">Crea tu cuenta sin salir del mismo ecosistema visual del juego para que el paso entre menus sea natural.</p>
          </div>

          <div className="auth-card auth-card-hub">
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label className="auth-label" htmlFor="username">Username</label>
                <input className="auth-input" id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={50} />
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="email">Email</label>
                <input className="auth-input" id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="password">Password</label>
                <input className="auth-input" id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} />

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
                <label className="auth-label" htmlFor="confirmPassword">Confirm Password</label>
                <input className="auth-input" id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              </div>

              {error ? <div className="auth-error">{error}</div> : null}

              <button className="btn-premium auth-submit" type="submit" disabled={loading}>
                {loading ? "CREANDO..." : "REGISTRARSE"}
              </button>
            </form>

            <p className="auth-linkline">
              Ya tienes cuenta?{" "}
              <button className="auth-inline-link" type="button" onClick={() => handleSoftNavigate("/login")}>
                Inicia sesion aqui
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
