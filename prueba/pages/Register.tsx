// ===== PÁGINA DE REGISTRO =====
import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    // Validaciones básicas
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
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
        Create Account
      </h1>
      
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <label htmlFor="username" style={{ 
            display: "block", 
            marginBottom: 6,
            fontSize: 13,
            fontWeight: 500,
            color: "#555"
          }}>
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={50}
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
            minLength={8}
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
          <label htmlFor="confirmPassword" style={{ 
            display: "block", 
            marginBottom: 6,
            fontSize: 13,
            fontWeight: 500,
            color: "#555"
          }}>
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
          {loading ? "Loading..." : "Register"}
        </button>
      </form>

      <p style={{ 
        marginTop: 30, 
        textAlign: "center",
        fontSize: 13,
        color: "#666"
      }}>
        Already have an account? <Link to="/login" style={{ color: "#111", textDecoration: "underline" }}>Login here</Link>
      </p>
    </div>
  );
}
