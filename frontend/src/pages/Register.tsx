import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { evaluatePasswordStrength } from "../utils/passwordStrength";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

type OAuthProvider = {
  id: string;
  label: string;
};

type OAuthLogoButton = {
  key: "42" | "google" | "github";
  label: string;
  imageSrc: string;
};

const OAUTH_LOGO_BUTTONS: OAuthLogoButton[] = [
  { key: "42", label: "42", imageSrc: "/42_logo.png" },
  { key: "google", label: "Google", imageSrc: "/google_logo.png" },
  { key: "github", label: "GitHub", imageSrc: "/github_logo.png" },
];

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
  const [oauthProviders, setOauthProviders] = useState<OAuthProvider[]>([]);
  const [leavingTarget, setLeavingTarget] = useState<"/login" | null>(null);

  const passwordStrength = useMemo(
    () => evaluatePasswordStrength(password, { email, username }),
    [password, email, username]
  );

  useEffect(() => {
    fetch(`${API}/api/auth/oauth/providers`)
      .then((response) => response.ok ? response.json() : { providers: [] })
      .then((data) => setOauthProviders(Array.isArray(data.providers) ? data.providers : []))
      .catch(() => setOauthProviders([]));
  }, []);

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

  const startOAuthLogin = (providerId: string) => {
    window.location.href = `${API}/api/auth/oauth/${encodeURIComponent(providerId)}`;
  };

  const getProviderForLogo = (providerKey: OAuthLogoButton["key"]) =>
    oauthProviders.find((provider) => {
      const normalizedId = provider.id.toLowerCase();
      const normalizedLabel = provider.label.toLowerCase();
      return normalizedId.includes(providerKey) || normalizedLabel.includes(providerKey);
    });

  return (
    <div className="app-container play-route-shell play-route-shell-center">
      <div className={`glass-panel play-hub-panel play-hub-panel-enter auth-hub-panel${leavingTarget ? " auth-hub-panel-leaving" : ""}`}>
        <div className="auth-hub-inner">
          <div className="auth-card auth-card-hub">
            <div className="auth-hub-copy auth-hub-copy-left">
              <h1 className="title-glow auth-hub-title">REGISTRARSE</h1>
              <p className="auth-hub-subtitle">Crea tu cuenta manteniendo la misma identidad visual para que el salto entre pantallas no sea brusco.</p>
            </div>
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
                        {rule.label}
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

          <div className="auth-brand-panel">
            <div className="auth-brand-copy">
              <h2>Accesos disponibles</h2>
              <p>Tambien puedes registrarte usando uno de los proveedores conectados del hub.</p>
            </div>
            <div className="auth-brand-grid">
              {OAUTH_LOGO_BUTTONS.map((logoButton) => {
                const provider = getProviderForLogo(logoButton.key);
                return (
                  <button
                    key={logoButton.key}
                    type="button"
                    className={`auth-brand-tile auth-brand-tile-button auth-brand-tile-${logoButton.key}${provider ? "" : " is-disabled"}`}
                    aria-label={logoButton.label}
                    title={provider ? `Continuar con ${logoButton.label}` : `${logoButton.label} no disponible`}
                    onClick={() => {
                      if (provider) {
                        startOAuthLogin(provider.id);
                      }
                    }}
                    disabled={!provider}
                  >
                    <img className="auth-brand-logo" src={logoButton.imageSrc} alt={logoButton.label} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
