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
    <div style={{ 
      maxWidth: 400, 
      margin: "60px auto", 
      padding: 20,
      fontFamily: "system-ui, -apple-system, sans-serif"
    }}>
      <h1 style={{ 
        fontSize: 24, 
        fontWeight: 600, 
        marginBottom: 30,
        color: "#111"
      }}>
        Login
      </h1>
      
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <label htmlFor="email" style={{ 
            display: "block", 
            marginBottom: 6,
            fontSize: 13,
            fontWeight: 500,
            color: "#555"
          }}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ 
              width: "100%", 
              padding: 10, 
              fontSize: 14,
              border: "1px solid #ddd",
              backgroundColor: "#fafafa",
              color: "#111"
            }}
          />
        </div>

        <div>
          <label htmlFor="password" style={{ 
            display: "block", 
            marginBottom: 6,
            fontSize: 13,
            fontWeight: 500,
            color: "#555"
          }}>
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ 
              width: "100%", 
              padding: 10, 
              fontSize: 14,
              border: "1px solid #ddd",
              backgroundColor: "#fafafa",
              color: "#111"
            }}
          />
        </div>

        {requires2FA && (
          <div>
            <label htmlFor="twoFAToken" style={{ 
              display: "block", 
              marginBottom: 6,
              fontSize: 13,
              fontWeight: 500,
              color: "#555"
            }}>
              2FA Code (6 digits)
            </label>
            <input
              id="twoFAToken"
              type="text"
              value={twoFAToken}
              onChange={(e) => setTwoFAToken(e.target.value)}
              placeholder="000000"
              maxLength={6}
              style={{ 
                width: "100%", 
                padding: 10, 
                fontSize: 16,
                textAlign: "center",
                letterSpacing: "0.3em",
                border: "1px solid #ddd",
                backgroundColor: "#fafafa",
                color: "#111"
              }}
            />
          </div>
        )}

        {error && (
          <div style={{ 
            fontSize: 13, 
            color: "#555",
            backgroundColor: "#f5f5f5",
            padding: 10,
            border: "1px solid #ddd"
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: 12,
            fontSize: 14,
            fontWeight: 500,
            backgroundColor: loading ? "#f5f5f5" : "#111",
            color: loading ? "#999" : "white",
            border: "1px solid #111",
            cursor: loading ? "not-allowed" : "pointer",
            marginTop: 10
          }}
        >
          {loading ? "Loading..." : "Login"}
        </button>
      </form>

      <p style={{ 
        marginTop: 30, 
        textAlign: "center",
        fontSize: 13,
        color: "#666"
      }}>
        Don't have an account? <Link to="/register" style={{ color: "#111", textDecoration: "underline" }}>Register here</Link>
      </p>
    </div>
  );
}
