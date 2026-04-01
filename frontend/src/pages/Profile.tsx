// ===== PÁGINA DE PERFIL CON 2FA =====
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import SocialPanel from "../components/SocialPanel";
import { evaluatePasswordStrength } from "../utils/passwordStrength";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

function resolveAvatarUrl(avatarUrl?: string | null): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
    return avatarUrl;
  }
  return `${API}${avatarUrl}`;
}

export default function Profile() {
  const { user, token, logout, setCurrentUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "social">("profile");
  
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const passwordStrength = useMemo(
    () => evaluatePasswordStrength(newPassword, { email: user?.email, username: user?.username }),
    [newPassword, user?.email, user?.username]
  );

  useEffect(() => {
    if (user) {
      setTwoFAEnabled(user.twoFAEnabled);
      setUsername(user.username ?? "");
      setDisplayName(user.displayName ?? "");
      setBio(user.bio ?? "");
      setAvatarUrl(user.avatarUrl ?? "");
    }
  }, [user]);

  const profileValidationError = useMemo(() => {
    const trimmedUsername = username.trim();
    const trimmedDisplayName = displayName.trim();
    const trimmedBio = bio.trim();

    if (trimmedUsername.length < 3 || trimmedUsername.length > 50) {
      return "El username debe tener entre 3 y 50 caracteres";
    }

    if (trimmedDisplayName.length > 0 && trimmedDisplayName.length < 2) {
      return "El nombre visible debe tener al menos 2 caracteres";
    }

    if (trimmedDisplayName.length > 80) {
      return "El nombre visible no puede superar 80 caracteres";
    }

    if (trimmedBio.length > 280) {
      return "La bio no puede superar 280 caracteres";
    }

    return null;
  }, [bio, displayName, username]);

  const handleProfileSave = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);

    if (profileValidationError) {
      setMessage({ type: "error", text: profileValidationError });
      return;
    }

    if (!token) {
      setMessage({ type: "error", text: "Sesion expirada. Inicia sesion de nuevo" });
      return;
    }

    setSavingProfile(true);
    try {
      const response = await fetch(`${API}/api/auth/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: username.trim(),
          displayName: displayName.trim() || undefined,
          bio: bio.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "No se pudo actualizar el perfil" });
        return;
      }

      setCurrentUser(data.user);
      setMessage({ type: "success", text: "Informacion personal actualizada correctamente" });
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion al actualizar perfil" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async () => {
    setMessage(null);

    if (!token) {
      setMessage({ type: "error", text: "Sesion expirada. Inicia sesion de nuevo" });
      return;
    }

    if (!avatarFile) {
      setMessage({ type: "error", text: "Selecciona una imagen antes de subir" });
      return;
    }

    if (avatarFile.size > 2 * 1024 * 1024) {
      setMessage({ type: "error", text: "El archivo supera el limite de 2MB" });
      return;
    }

    setUploadingAvatar(true);

    try {
      const formData = new FormData();
      formData.append("avatar", avatarFile);

      const response = await fetch(`${API}/api/auth/profile/avatar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "No se pudo subir el avatar" });
        return;
      }

      setCurrentUser(data.user);
      setAvatarUrl(data.user.avatarUrl ?? "");
      setAvatarFile(null);
      setMessage({ type: "success", text: "Avatar actualizado correctamente" });
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion al subir avatar" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarDelete = async () => {
    setMessage(null);

    if (!token) {
      setMessage({ type: "error", text: "Sesion expirada. Inicia sesion de nuevo" });
      return;
    }

    setUploadingAvatar(true);
    try {
      const response = await fetch(`${API}/api/auth/profile/avatar`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "No se pudo eliminar el avatar" });
        return;
      }

      setCurrentUser(data.user);
      setAvatarUrl("");
      setAvatarFile(null);
      setMessage({ type: "success", text: "Avatar eliminado. Se usa el predeterminado" });
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion al eliminar avatar" });
    } finally {
      setUploadingAvatar(false);
    }
  };

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
        if (user) {
          setCurrentUser({ ...user, twoFAEnabled: true });
        }
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
        if (user) {
          setCurrentUser({ ...user, twoFAEnabled: false });
        }
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

  const handlePasswordChange = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);

    if (!token) {
      setMessage({ type: "error", text: "Sesion expirada. Inicia sesion de nuevo" });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setMessage({ type: "error", text: "La nueva contraseña y su confirmacion no coinciden" });
      return;
    }

    if (newPassword.length < 12) {
      setMessage({ type: "error", text: "La nueva contraseña debe tener al menos 12 caracteres" });
      return;
    }

    if (passwordStrength.level === "weak") {
      setMessage({ type: "error", text: "La nueva contraseña no cumple los requisitos de seguridad" });
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch(`${API}/api/auth/password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "No se pudo actualizar la contraseña" });
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setMessage({ type: "success", text: "Contraseña actualizada correctamente" });
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion al cambiar contraseña" });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="profile-shell">
      <h1 className="page-title">Profile</h1>

      <div className="profile-tabs">
        <button
          className={`tab-btn ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          Informacion personal
        </button>
        <button
          className={`tab-btn ${activeTab === "security" ? "active" : ""}`}
          onClick={() => setActiveTab("security")}
        >
          Seguridad
        </button>
        <button
          className={`tab-btn ${activeTab === "social" ? "active" : ""}`}
          onClick={() => setActiveTab("social")}
        >
          Social
        </button>
      </div>

      {activeTab === "profile" && (
        <form
          onSubmit={handleProfileSave}
          style={{ border: "1px solid #ddd", padding: 20, marginBottom: 30, display: "grid", gap: 14 }}
        >
          <div style={{ fontSize: 13, color: "#666" }}>
            Puedes actualizar tu username, nombre visible, bio y avatar.
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#555" }}>Email (solo lectura)</span>
            <input
              type="email"
              value={user?.email ?? ""}
              readOnly
              style={{ padding: 10, fontSize: 14, border: "1px solid #ddd", backgroundColor: "#f7f7f7", color: "#666" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#555" }}>Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={3}
              maxLength={50}
              required
              style={{ padding: 10, fontSize: 14, border: "1px solid #ddd", backgroundColor: "#fafafa", color: "#111" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#555" }}>Nombre visible</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              minLength={2}
              maxLength={80}
              placeholder="Tu nombre en el perfil"
              style={{ padding: 10, fontSize: 14, border: "1px solid #ddd", backgroundColor: "#fafafa", color: "#111" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#555" }}>Avatar (archivo de imagen)</span>
            {resolveAvatarUrl(avatarUrl) && (
              <img
                src={resolveAvatarUrl(avatarUrl) ?? ""}
                alt="Avatar actual"
                style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8, border: "1px solid #ddd" }}
              />
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
              style={{ padding: 10, fontSize: 14, border: "1px solid #ddd", backgroundColor: "#fafafa", color: "#111" }}
            />
            {avatarFile && (
              <div style={{ fontSize: 12, color: "#666" }}>
                Seleccionado: {avatarFile.name} ({Math.round(avatarFile.size / 1024)} KB)
              </div>
            )}
            <div style={{ fontSize: 12, color: "#777" }}>Formatos permitidos: PNG, JPG, WEBP, GIF. Maximo 2MB.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={handleAvatarUpload}
                disabled={uploadingAvatar || !avatarFile}
                style={{
                  flex: 1,
                  padding: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  backgroundColor: uploadingAvatar || !avatarFile ? "#f5f5f5" : "#111",
                  color: uploadingAvatar || !avatarFile ? "#999" : "white",
                  border: "1px solid #111",
                  cursor: uploadingAvatar || !avatarFile ? "not-allowed" : "pointer",
                  marginTop: 4,
                }}
              >
                {uploadingAvatar ? "Subiendo avatar..." : "Subir avatar"}
              </button>
              <button
                type="button"
                onClick={handleAvatarDelete}
                disabled={uploadingAvatar || !avatarUrl}
                style={{
                  flex: 1,
                  padding: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  backgroundColor: uploadingAvatar || !avatarUrl ? "#f5f5f5" : "white",
                  color: uploadingAvatar || !avatarUrl ? "#999" : "#111",
                  border: "1px solid #ddd",
                  cursor: uploadingAvatar || !avatarUrl ? "not-allowed" : "pointer",
                  marginTop: 4,
                }}
              >
                Eliminar avatar
              </button>
            </div>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#555" }}>Bio</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              rows={4}
              placeholder="Cuéntanos algo sobre ti"
              style={{ padding: 10, fontSize: 14, border: "1px solid #ddd", backgroundColor: "#fafafa", color: "#111", resize: "vertical" }}
            />
          </label>

          <div style={{ fontSize: 12, color: "#777" }}>{bio.length}/280</div>

          <button
            type="submit"
            disabled={savingProfile || !!profileValidationError}
            style={{
              padding: 10,
              fontSize: 13,
              fontWeight: 600,
              backgroundColor: savingProfile || !!profileValidationError ? "#f5f5f5" : "#111",
              color: savingProfile || !!profileValidationError ? "#999" : "white",
              border: "1px solid #111",
              cursor: savingProfile || !!profileValidationError ? "not-allowed" : "pointer",
            }}
          >
            {savingProfile ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      )}

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
      {activeTab === "security" && (
      <div style={{ border: "1px solid #ddd", padding: 20, marginBottom: 30 }}>
        <h2 style={{
          fontSize: 14,
          fontWeight: 600,
          marginTop: 0,
          marginBottom: 10,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "#555"
        }}>
          Password Security
        </h2>
        <form onSubmit={handlePasswordChange} style={{ display: "grid", gap: 10, marginBottom: 22 }}>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Contraseña actual"
            required
            style={{ padding: 10, fontSize: 14, border: "1px solid #ddd", backgroundColor: "#fafafa", color: "#111" }}
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nueva contraseña"
            minLength={12}
            required
            style={{ padding: 10, fontSize: 14, border: "1px solid #ddd", backgroundColor: "#fafafa", color: "#111" }}
          />

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
                  {rule.passed ? "OK" : "-"} {rule.label}
                </li>
              ))}
            </ul>
          </div>

          <input
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            placeholder="Confirmar nueva contraseña"
            minLength={12}
            required
            style={{ padding: 10, fontSize: 14, border: "1px solid #ddd", backgroundColor: "#fafafa", color: "#111" }}
          />
          <div style={{ fontSize: 12, color: "#777" }}>
            Requisitos: 12+ caracteres, mayúsculas, minúsculas, números y símbolos.
          </div>
          <button
            type="submit"
            disabled={savingPassword}
            style={{
              padding: 10,
              fontSize: 13,
              fontWeight: 600,
              backgroundColor: savingPassword ? "#f5f5f5" : "#111",
              color: savingPassword ? "#999" : "white",
              border: "1px solid #111",
              cursor: savingPassword ? "not-allowed" : "pointer",
            }}
          >
            {savingPassword ? "Actualizando..." : "Actualizar contraseña"}
          </button>
        </form>

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
      )}

      {activeTab === "social" && <SocialPanel token={token} />}

      {/* Acciones de la cuenta */}
      <div className="split-actions">
        <button
          onClick={() => navigate("/")}
          className="btn btn-outline"
        >
          ← Back
        </button>
        
        <button
          onClick={handleLogout}
          className="btn btn-primary"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
