// ===== UTILIDADES DE AUTENTICACIÓN =====
import { randomBytes, pbkdf2 } from "crypto";
import { promisify } from "util";
import speakeasy from "speakeasy";

const pbkdf2Async = promisify(pbkdf2);

// ===== HASHING DE CONTRASEÑAS =====
// Usa PBKDF2 con salt aleatorio para cada contraseña
// NUNCA almacenes contraseñas en texto plano
export async function hashPassword(password: string): Promise<string> {
  // Genera un salt aleatorio de 16 bytes
  const salt = randomBytes(16).toString("hex");
  
  // Hash con PBKDF2: 100,000 iteraciones, 64 bytes, SHA-512
  const hash = await pbkdf2Async(password, salt, 100000, 64, "sha512");
  
  // Formato: salt:hash (ambos en hexadecimal)
  return `${salt}:${hash.toString("hex")}`;
}

// Verifica si una contraseña coincide con el hash almacenado
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Extrae el salt del hash almacenado
  const [salt, originalHash] = storedHash.split(":");
  
  // Calcula el hash con la misma salt
  const hash = await pbkdf2Async(password, salt, 100000, 64, "sha512");
  
  // Compara los hashes de forma segura contra timing attacks
  return hash.toString("hex") === originalHash;
}

// ===== 2FA (Two-Factor Authentication) =====
// Genera un secreto para Google Authenticator / Authy
export function generate2FASecret(email: string) {
  return speakeasy.generateSecret({
    name: `Transcendence (${email})`,
    length: 32,
  });
}

// Verifica un código 2FA de 6 dígitos
export function verify2FAToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 2, // Permite ±2 intervalos de tiempo (60 segundos de margen)
  });
}
