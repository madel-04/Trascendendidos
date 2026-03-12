// ===== PÁGINA DE PERFIL CON 2FA =====
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

export default function Profile() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setTwoFAEnabled(user.twoFAEnabled);
    }
  }, [user]);

  // Generar QR code para configurar 2FA
  const handleSetup2FA = async () => {
    setLoading(true);
    setMessage(null);
    
    try {
      const response = await fetch(`${API}/api/auth/2fa/setup`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setQrCodeUrl(data.qrCodeUrl);
        setSecret(data.secret);
        setShowSetup(true);
        setMessage({ type: "success", text: "Escanea el código QR con Google Authenticator o Authy" });
      } else {
        setMessage({ type: "error", text: data.error || "Error al generar código QR" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Error de conexión" });
    } finally {
      setLoading(false);
    }
  };

  // Habilitar 2FA con código de verificación
  const handleEnable2FA = async () => {
    if (verificationCode.length !== 6) {
      setMessage({ type: "error", text: "El código debe tener 6 dígitos" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API}/api/auth/2fa/enable`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token: verificationCode }),
      });

      const data = await response.json();

      if (response.ok) {
        setTwoFAEnabled(true);
        setShowSetup(false);
        setQrCodeUrl(null);
        setVerificationCode("");
        setMessage({ type: "success", text: "¡2FA habilitado exitosamente! 🎉" });
        
        // Actualizar usuario en el contexto
        window.location.reload();
      } else {
        setMessage({ type: "error", text: data.error || "Código incorrecto" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Error de conexión" });
    } finally {
      setLoading(false);
    }
  };

  // Deshabilitar 2FA
  const handleDisable2FA = async () => {
    if (!confirm("¿Estás seguro de que quieres deshabilitar 2FA?")) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API}/api/auth/2fa/disable`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setTwoFAEnabled(false);
        setMessage({ type: "success", text: "2FA deshabilitado" });
        
        // Actualizar usuario en el contexto
        window.location.reload();
      } else {
        setMessage({ type: "error", text: data.error || "Error al deshabilitar 2FA" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Error de conexión" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div style={{ 
      maxWidth: 500, 
      margin: "40px auto", 
      padding: 20,
      fontFamily: "system-ui, -apple-system, sans-serif"
    }}>
      <h1 style={{ 
        fontSize: 24, 
        fontWeight: 600, 
        marginBottom: 30,
        color: "#111"
      }}>
        Profile
      </h1>

      {/* Información del usuario */}
      <div style={{ 
        border: "1px solid #ddd",
        padding: 20, 
        marginBottom: 30
      }}>
        <h2 style={{ 
          fontSize: 14, 
          fontWeight: 600, 
          marginTop: 0,
          marginBottom: 15,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "#555"
        }}>
          Account Information
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: "#333" }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: "#888" }}>Username:</span> {user?.username}
          </div>
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: "#888" }}>Email:</span> {user?.email}
          </div>
          <div>
            <span style={{ color: "#888" }}>2FA:</span> {twoFAEnabled ? "Enabled" : "Disabled"}
          </div>
        </div>
      </div>

      {/* Mensajes */}
      {message && (
        <div style={{
          padding: 12,
          marginBottom: 20,
          fontSize: 14,
          backgroundColor: message.type === "success" ? "#f0f0f0" : "#f5f5f5",
          color: message.type === "success" ? "#111" : "#555",
          border: `1px solid ${message.type === "success" ? "#ddd" : "#ccc"}`,
        }}>
          {message.text}
        </div>
      )}

      {/* Sección 2FA */}
      <div style={{ 
        border: "1px solid #ddd", 
        padding: 20,
        marginBottom: 30
      }}>
        <h2 style={{ 
          fontSize: 14, 
          fontWeight: 600, 
          marginTop: 0,
          marginBottom: 10,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "#555"
        }}>
          Two-Factor Authentication
        </h2>
        <p style={{ 
          fontSize: 13, 
          color: "#666", 
          lineHeight: 1.6,
          marginBottom: 20 
        }}>
          Add an extra layer of security to your account.
        </p>

        {!twoFAEnabled && !showSetup && (
          <button
            onClick={handleSetup2FA}
            disabled={loading}
            style={{
              padding: 10,
              fontSize: 13,
              fontWeight: 500,
              backgroundColor: loading ? "#f5f5f5" : "#111",
              color: loading ? "#999" : "white",
              border: "1px solid #111",
              cursor: loading ? "not-allowed" : "pointer",
              width: "100%",
              transition: "all 0.2s"
            }}
          >
            {loading ? "Loading..." : "Enable 2FA"}
          </button>
        )}

        {!twoFAEnabled && showSetup && qrCodeUrl && (
          <div>
            <div style={{ 
              fontSize: 13, 
              fontWeight: 500,
              marginBottom: 15,
              color: "#333"
            }}>
              Step 1: Scan QR Code
            </div>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
              Use Google Authenticator, Authy or any TOTP app
            </p>
            
            <div style={{ 
              textAlign: "center", 
              padding: 20, 
              backgroundColor: "white",
              border: "1px solid #ddd",
              marginBottom: 20
            }}>
              <img 
                src={qrCodeUrl} 
                alt="QR Code for 2FA" 
                style={{ maxWidth: "200px", height: "auto" }}
              />
            </div>

            <details style={{ marginBottom: 20 }}>
              <summary style={{ 
                fontSize: 12, 
                color: "#666", 
                cursor: "pointer",
                marginBottom: 10
              }}>
                Can't scan? Enter code manually
              </summary>
              <code style={{ 
                display: "block", 
                backgroundColor: "#f5f5f5", 
                padding: 10, 
                fontSize: 11,
                border: "1px solid #ddd",
                wordBreak: "break-all",
                color: "#333"
              }}>
                {secret}
              </code>
            </details>

            <div style={{ 
              fontSize: 13, 
              fontWeight: 500,
              marginBottom: 15,
              color: "#333"
            }}>
              Step 2: Verify Code
            </div>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
              Enter the 6-digit code from your app
            </p>
            
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              style={{
                width: "100%",
                padding: 12,
                fontSize: 20,
                textAlign: "center",
                letterSpacing: "0.5em",
                marginBottom: 12,
                border: "1px solid #ddd",
                backgroundColor: "#fafafa",
                color: "#111"
              }}
            />

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleEnable2FA}
                disabled={loading || verificationCode.length !== 6}
                style={{
                  flex: 1,
                  padding: 10,
                  fontSize: 13,
                  fontWeight: 500,
                  backgroundColor: loading || verificationCode.length !== 6 ? "#f5f5f5" : "#111",
                  color: loading || verificationCode.length !== 6 ? "#999" : "white",
                  border: "1px solid #111",
                  cursor: loading || verificationCode.length !== 6 ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Verifying..." : "Verify & Enable"}
              </button>
              
              <button
                onClick={() => {
                  setShowSetup(false);
                  setQrCodeUrl(null);
                  setVerificationCode("");
                }}
                disabled={loading}
                style={{
                  padding: 10,
                  fontSize: 13,
                  fontWeight: 500,
                  backgroundColor: "white",
                  color: "#666",
                  border: "1px solid #ddd",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {twoFAEnabled && (
          <div>
            <div style={{
              padding: 12,
              marginBottom: 15,
              fontSize: 13,
              backgroundColor: "#f5f5f5",
              color: "#333",
              border: "1px solid #ddd",
            }}>
              Your account is protected with 2FA
            </div>
            
            <button
              onClick={handleDisable2FA}
              disabled={loading}
              style={{
                padding: 10,
                fontSize: 13,
                fontWeight: 500,
                backgroundColor: loading ? "#f5f5f5" : "white",
                color: loading ? "#999" : "#111",
                border: "1px solid #ddd",
                cursor: loading ? "not-allowed" : "pointer",
                width: "100%",
              }}
            >
              {loading ? "Loading..." : "Disable 2FA"}
            </button>
          </div>
        )}
      </div>

      {/* Acciones de la cuenta */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => navigate("/")}
          style={{
            flex: 1,
            padding: 10,
            fontSize: 13,
            fontWeight: 500,
            backgroundColor: "white",
            color: "#666",
            border: "1px solid #ddd",
            cursor: "pointer",
          }}
        >
          ← Back
        </button>
        
        <button
          onClick={handleLogout}
          style={{
            flex: 1,
            padding: 10,
            fontSize: 13,
            fontWeight: 500,
            backgroundColor: "#111",
            color: "white",
            border: "1px solid #111",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
