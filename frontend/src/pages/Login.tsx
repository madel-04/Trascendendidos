import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

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

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const timeoutRef = useRef<number | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFAToken, setTwoFAToken] = useState("");
  const [requires2FA, setRequires2FA] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<OAuthProvider[]>([]);
  const [leavingTarget, setLeavingTarget] = useState<"/register" | null>(null);

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

  const handleSoftNavigate = (target: "/register") => {
    if (leavingTarget) return;
    setLeavingTarget(target);
    timeoutRef.current = window.setTimeout(() => navigate(target), 420);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password, twoFAToken || undefined);
      navigate("/play");
    } catch (err: any) {
      if (err.message.includes("2FA")) {
        setRequires2FA(true);
        setError("Ingresa tu codigo 2FA");
      } else {
        setError(err.message || "Error en el login");
      }
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
              <h1 className="title-glow auth-hub-title">INICIAR SESION</h1>
              <p className="auth-hub-subtitle">Entra sin salir del mismo entorno visual del juego y continua directamente hacia el menu principal.</p>
            </div>
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label className="auth-label" htmlFor="email">Email</label>
                <input className="auth-input" id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="password">Password</label>
                <input className="auth-input" id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>

              {requires2FA ? (
                <div className="auth-field">
                  <label className="auth-label" htmlFor="twoFAToken">2FA Code</label>
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
              ) : null}

              {error ? <div className="auth-error">{error}</div> : null}

              <button className="btn-premium auth-submit" type="submit" disabled={loading}>
                {loading ? "CARGANDO..." : "INICIAR SESION"}
              </button>
            </form>

            <p className="auth-linkline">
              Aun no tienes cuenta?{" "}
              <button className="auth-inline-link" type="button" onClick={() => handleSoftNavigate("/register")}>
                Registrate aqui
              </button>
            </p>
          </div>

          <div className="auth-brand-panel">
            <div className="auth-brand-copy">
              <h2>Accesos disponibles</h2>
              <p>Accede con email y password o entra desde uno de los proveedores ya conectados.</p>
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
