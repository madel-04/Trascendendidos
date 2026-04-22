import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function OAuthCallback() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
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
      setError("OAuth response did not include an access token");
      return;
    }

    loginWithToken(token)
      .then(() => navigate("/play", { replace: true }))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "OAuth login failed");
      });
  }, [loginWithToken, navigate, searchParams]);

  return (
    <div className="auth-card">
      <h1 className="page-title">Remote login</h1>
      {error ? (
        <>
          <div className="auth-error">{error}</div>
          <p className="auth-linkline">
            <Link to="/login">Back to login</Link>
          </p>
        </>
      ) : (
        <p>Completing authentication...</p>
      )}
    </div>
  );
}
