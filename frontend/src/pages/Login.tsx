import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

type OAuthProvider = {
  id: string;
  label: string;
};

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

  return (
    <div className="app-container play-route-shell play-route-shell-center">
      <div className={`glass-panel play-hub-panel play-hub-panel-enter auth-hub-panel${leavingTarget ? " auth-hub-panel-leaving" : ""}`}>
        <div className="auth-hub-inner">
          <div className="auth-hub-copy">
            <div className="main-menu-kicker">ACCESO NEON</div>
            <h1 className="title-glow auth-hub-title">INICIAR SESION</h1>
            <p className="auth-hub-subtitle">Accede al menu principal, partidas online, torneos y organizaciones sin salir del mismo entorno visual.</p>
          </div>

          <div className="auth-card auth-card-hub">
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

            {oauthProviders.length > 0 ? (
              <div className="oauth-section">
                <div className="oauth-divider">o</div>
                <div className="oauth-buttons">
                  {oauthProviders.map((provider) => (
                    <button
                      key={provider.id}
                      className="btn-premium secondary oauth-btn"
                      type="button"
                      onClick={() => startOAuthLogin(provider.id)}
                    >
                      Continuar con {provider.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <p className="auth-linkline">
              Aun no tienes cuenta?{" "}
              <button className="auth-inline-link" type="button" onClick={() => handleSoftNavigate("/register")}>
                Registrate aqui
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
