import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

export default function OAuthCallback() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    const oauthError = searchParams.get("error");

    if (oauthError) {
      setError(oauthError);
      return;
    }

    if (!token) {
      setError(t("OAUTH_TOKEN_ERROR"));
      return;
    }

    loginWithToken(token)
      .then(() => navigate("/play", { replace: true }))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("OAUTH_LOGIN_FAILED"));
      });
  }, [loginWithToken, navigate, searchParams, t]);

  return (
    <div className="auth-card">
      <h1 className="page-title">{t("REMOTE_LOGIN")}</h1>
      {error ? (
        <>
          <div className="auth-error">{error}</div>
          <p className="auth-linkline">
            <Link to="/login">{t("BACK_TO_LOGIN")}</Link>
          </p>
        </>
      ) : (
        <p>{t("COMPLETING_AUTH")}</p>
      )}
    </div>
  );
}
