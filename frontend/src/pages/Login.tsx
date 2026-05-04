// ===== PÁGINA DE LOGIN =====
import { useEffect, useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import githubLogo from "../assets/oauth-github.svg";
import fortyTwoLogo from "../assets/oauth-42.svg";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

type OAuthProvider = {
  id: string;
  label: string;
};

type OAuthProviderMeta = {
  badge: string;
  tagline: string;
  tone: string;
};

const OAUTH_PROVIDER_META: Record<string, OAuthProviderMeta> = {
  google: {
    badge: "G",
    tagline: "Fast sign in with your Google account",
    tone: "google",
  },
  github: {
    badge: "GH",
    tagline: "Developer login with GitHub",
    tone: "github",
  },
  "42": {
    badge: "42",
    tagline: "Campus SSO for 42 students and alumni",
    tone: "forty-two",
  },
};

const OAUTH_LOGOS: Record<string, string> = {
  google: "https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png",
  github: githubLogo,
  "42": fortyTwoLogo,
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFAToken, setTwoFAToken] = useState("");
  const [requires2FA, setRequires2FA] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirectingProvider, setRedirectingProvider] = useState<string | null>(null);
  const [oauthProviders, setOauthProviders] = useState<OAuthProvider[]>([]);

  useEffect(() => {
    fetch(`${API}/api/auth/oauth/providers`)
      .then((response) => response.ok ? response.json() : { providers: [] })
      .then((data) => setOauthProviders(Array.isArray(data.providers) ? data.providers : []))
      .catch(() => setOauthProviders([]));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password, twoFAToken || undefined);
      navigate("/play");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error en el login";
      if (message.includes("2FA")) {
        setRequires2FA(true);
        setError("Ingresa tu código 2FA");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const startOAuthLogin = (providerId: string) => {
    setError("");
    setRedirectingProvider(providerId);
    window.location.assign(`${API}/api/auth/oauth/${encodeURIComponent(providerId)}`);
  };

  const getOAuthMeta = (providerId: string): OAuthProviderMeta =>
    OAUTH_PROVIDER_META[providerId] ?? {
      badge: "SSO",
      tagline: "Remote login",
      tone: "generic",
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

        {error && <div className="auth-error">{error}</div>}

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Loading..." : "Login"}
        </button>
      </form>

      {oauthProviders.length > 0 && (
        <div className="oauth-section">
          <div className="oauth-divider">{t("or continue with")}</div>
          <div className="oauth-buttons">
            {oauthProviders.map((provider) => {
              const meta = getOAuthMeta(provider.id);
              const isRedirecting = redirectingProvider === provider.id;

              return (
                <button
                  key={provider.id}
                  className={`btn btn-outline oauth-btn oauth-btn-${meta.tone}`}
                  type="button"
                  onClick={() => startOAuthLogin(provider.id)}
                  disabled={loading || redirectingProvider !== null}
                >
                  {OAUTH_LOGOS[provider.id] ? (
                    <img
                      src={OAUTH_LOGOS[provider.id]}
                      alt={`${provider.label} logo`}
                      className={`oauth-logo oauth-logo-${provider.id}`}
                    />
                  ) : (
                    <span className="oauth-badge" aria-hidden="true">{meta.badge}</span>
                  )}
                  <span className="oauth-btn-copy">
                    <span className="oauth-btn-label">{t("Continue with " + provider.label)}</span>
                    <span className="oauth-btn-note">{isRedirecting ? t("Opening " + provider.label + "...") : t(meta.tagline)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p className="auth-linkline">
        Don&apos;t have an account? <Link to="/register">Register here</Link>
      </p>
    </div>
  );
}
