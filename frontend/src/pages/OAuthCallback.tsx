import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

type OAuthProviderMeta = {
  badge: string;
  label: string;
  tagline: string;
  tone: string;
};

const OAUTH_PROVIDER_META: Record<string, OAuthProviderMeta> = {
  google: {
    badge: "G",
    label: "Google",
    tagline: "Return to the Google sign-in flow",
    tone: "google",
  },
  github: {
    badge: "GH",
    label: "GitHub",
    tagline: "Return to the GitHub sign-in flow",
    tone: "github",
  },
  "42": {
    badge: "42",
    label: "42",
    tagline: "Return to the 42 sign-in flow",
    tone: "forty-two",
  },
};

export default function OAuthCallback() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");
  const providerId = searchParams.get("provider") ?? "";
  const providerMeta = providerId ? OAUTH_PROVIDER_META[providerId] : undefined;

  useEffect(() => {
    const token = searchParams.get("token");
    const oauthError = searchParams.get("error");

    if (oauthError) {
      setError(oauthError);
      return;
    }

    if (!token) {
      setError(t("Something went wrong with your login"));
      return;
    }

    loginWithToken(token)
      .then(() => navigate("/play", { replace: true }))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "OAuth login failed");
      });
  }, [loginWithToken, navigate, searchParams]);

  const retryOAuth = () => {
    if (!providerId) {
      navigate("/login", { replace: true });
      return;
    }

    window.location.assign(`${API}/api/auth/oauth/${encodeURIComponent(providerId)}`);
  };

  return (
    <div className="auth-card">
      <h1 className="page-title">{t("OAuth Error")}</h1>
      {error ? (
        <div className="oauth-callback-panel">
          <div className={`oauth-callback-status oauth-callback-status-${providerMeta?.tone ?? "generic"}`}>
            <div className="oauth-badge" aria-hidden="true">{providerMeta?.badge ?? "SSO"}</div>
            <div>
              <h2 className="oauth-callback-title">
                {t("OAuth Error")}
              </h2>
              <p className="oauth-callback-copy">
                {t("Something went wrong with your login")}
              </p>
            </div>
          </div>
          <div className="auth-error">{error}</div>
          <div className="oauth-callback-actions">
            <button className="btn btn-primary" type="button" onClick={retryOAuth}>
              {t("Try again")}
            </button>
            <Link className="btn btn-outline" to="/login">
              {t("Choose another provider")}
            </Link>
          </div>
        </div>
      ) : (
        <p>Completing authentication...</p>
      )}
    </div>
  );
}
