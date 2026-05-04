// ===== RUTAS DE AUTENTICACIÓN =====
import { FastifyInstance } from "fastify";
import { z } from "zod";
import QRCode from "qrcode";
import { mkdir, unlink } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";
import sharp from "sharp";
import { query } from "../db.js";
import { env } from "../env.js";
import { hashPassword, verifyPassword, generate2FASecret, verify2FAToken } from "../utils/auth.js";
import { authRateLimiter } from "../utils/rateLimit.js";

// ===== SCHEMAS DE VALIDACIÓN =====
const RegisterSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  username: z.string().min(3, "El username debe tener al menos 3 caracteres").max(50),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  twoFAToken: z.string().optional(), // Código de 6 dígitos si 2FA está habilitado
});

const Enable2FASchema = z.object({
  token: z.string().length(6, "El código 2FA debe tener 6 dígitos"),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Debes indicar tu contraseña actual"),
  newPassword: z.string().min(12, "La nueva contraseña debe tener al menos 12 caracteres"),
});

const UpdateProfileSchema = z.object({
  username: z.string().min(3, "El username debe tener al menos 3 caracteres").max(50),
  displayName: z
    .string()
    .trim()
    .min(2, "El nombre visible debe tener al menos 2 caracteres")
    .max(80, "El nombre visible no puede superar 80 caracteres")
    .optional(),
  bio: z
    .string()
    .trim()
    .max(280, "La bio no puede superar 280 caracteres")
    .optional(),
});

const ALLOWED_AVATAR_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;

const AVATAR_UPLOAD_DIR = path.join(process.cwd(), "uploads", "avatars");

const COMMON_WEAK_PASSWORDS = new Set([
  "password",
  "password123",
  "12345678",
  "123456789",
  "qwerty123",
  "admin123",
  "letmein",
  "welcome123",
]);

// ===== TIPOS =====
interface User {
  id: number;
  email: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  password_hash: string;
  two_fa_secret: string | null;
  two_fa_enabled: boolean;
  created_at: Date;
}

type OAuthProvider = "google" | "github" | "42";

interface OAuthProviderConfig {
  id: OAuthProvider;
  label: string;
  clientId?: string;
  clientSecret?: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}

interface OAuthProfile {
  providerUserId: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface OAuthAccount {
  user_id: number;
}

const OAUTH_PROVIDERS: Record<OAuthProvider, OAuthProviderConfig> = {
  google: {
    id: "google",
    label: "Google",
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
    scopes: ["openid", "email", "profile"],
  },
  github: {
    id: "github",
    label: "GitHub",
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
    scopes: ["read:user", "user:email"],
  },
  "42": {
    id: "42",
    label: "42",
    clientId: env.FORTYTWO_CLIENT_ID,
    clientSecret: env.FORTYTWO_CLIENT_SECRET,
    authorizeUrl: "https://api.intra.42.fr/oauth/authorize",
    tokenUrl: "https://api.intra.42.fr/oauth/token",
    userInfoUrl: "https://api.intra.42.fr/v2/me",
    scopes: ["public"],
  },
};

function toClientUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.display_name,
    bio: user.bio,
    avatarUrl: user.avatar_url,
    twoFAEnabled: user.two_fa_enabled,
    createdAt: user.created_at,
  };
}

function getConfiguredOAuthProviders(): OAuthProviderConfig[] {
  return Object.values(OAUTH_PROVIDERS).filter((provider) => provider.clientId && provider.clientSecret);
}

function getFrontendOrigin(): string {
  return env.FRONTEND_ORIGIN ?? env.CORS_ORIGIN.split(",")[0].trim();
}

function getOAuthRedirectUri(request: any, provider: OAuthProvider): string {
  const backendOrigin = env.PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? `${request.protocol}://${request.hostname}`;
  return `${backendOrigin}/api/auth/oauth/${provider}/callback`;
}

function redirectWithOAuthError(reply: any, message: string, provider?: OAuthProvider) {
  const url = new URL("/oauth/callback", getFrontendOrigin());
  url.searchParams.set("error", message);
  if (provider) {
    url.searchParams.set("provider", provider);
  }
  return reply.redirect(url.toString());
}

function createAuthToken(app: FastifyInstance, user: Pick<User, "id" | "email">): string {
  return app.jwt.sign(
    { userId: user.id, email: user.email },
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

function sanitizeUsername(value: string): string {
  const normalized = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 42);

  return normalized.length >= 3 ? normalized : `user${normalized}`;
}

async function buildUniqueUsername(preferredUsername: string): Promise<string> {
  const base = sanitizeUsername(preferredUsername);
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const suffix = attempt === 0 ? "" : `${attempt + 1}`;
    const candidate = `${base}${suffix}`.slice(0, 50);
    const existing = await query<User>("SELECT id FROM users WHERE username = $1", [candidate]);
    if (existing.length === 0) return candidate;
  }
  return `${base.slice(0, 32)}-${randomUUID().slice(0, 12)}`;
}

async function exchangeOAuthCode(
  provider: OAuthProviderConfig,
  code: string,
  redirectUri: string
): Promise<string> {
  const response = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: provider.clientId!,
      client_secret: provider.clientSecret!,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const data = await response.json() as { access_token?: string; error_description?: string; error?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "No se pudo completar OAuth");
  }
  return data.access_token;
}

async function fetchGithubEmail(accessToken: string): Promise<string | null> {
  const response = await fetch("https://api.github.com/user/emails", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "Trascendence-OAuth",
    },
  });
  if (!response.ok) return null;

  const emails = await response.json() as Array<{ email?: string; primary?: boolean; verified?: boolean }>;
  return emails.find((email) => email.primary && email.verified)?.email
    ?? emails.find((email) => email.verified)?.email
    ?? null;
}

async function fetchOAuthProfile(provider: OAuthProviderConfig, accessToken: string): Promise<OAuthProfile> {
  const response = await fetch(provider.userInfoUrl, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "Trascendence-OAuth",
    },
  });

  if (!response.ok) {
    throw new Error("No se pudo obtener el perfil OAuth");
  }

  const profile = await response.json() as any;
  if (provider.id === "google") {
    return {
      providerUserId: String(profile.sub),
      email: String(profile.email ?? ""),
      username: String(profile.email?.split("@")[0] ?? profile.name ?? "google-user"),
      displayName: profile.name ? String(profile.name) : null,
      avatarUrl: profile.picture ? String(profile.picture) : null,
    };
  }

  if (provider.id === "github") {
    const email = typeof profile.email === "string" && profile.email
      ? profile.email
      : await fetchGithubEmail(accessToken);
    return {
      providerUserId: String(profile.id),
      email: String(email ?? ""),
      username: String(profile.login ?? "github-user"),
      displayName: profile.name ? String(profile.name) : null,
      avatarUrl: profile.avatar_url ? String(profile.avatar_url) : null,
    };
  }

  return {
    providerUserId: String(profile.id),
    email: String(profile.email ?? ""),
    username: String(profile.login ?? profile.usual_full_name ?? "42-user"),
    displayName: profile.displayname ? String(profile.displayname) : profile.usual_full_name ? String(profile.usual_full_name) : null,
    avatarUrl: profile.image?.link ? String(profile.image.link) : null,
  };
}

async function findOrCreateOAuthUser(provider: OAuthProvider, profile: OAuthProfile): Promise<User> {
  if (!profile.providerUserId || !profile.email) {
    throw new Error("El proveedor OAuth no devolvio email verificable");
  }

  const [linkedAccount] = await query<OAuthAccount>(
    "SELECT user_id FROM oauth_accounts WHERE provider = $1 AND provider_user_id = $2",
    [provider, profile.providerUserId]
  );

  if (linkedAccount) {
    const [user] = await query<User>(
      "SELECT * FROM users WHERE id = $1",
      [linkedAccount.user_id]
    );
    if (user) return user;
  }

  const [existingUser] = await query<User>(
    "SELECT * FROM users WHERE email = $1",
    [profile.email]
  );

  const user = existingUser ?? (await createUserFromOAuthProfile(profile));

  await query(
    `INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_email)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (provider, provider_user_id)
     DO UPDATE SET user_id = EXCLUDED.user_id,
                   provider_email = EXCLUDED.provider_email,
                   updated_at = NOW()`,
    [user.id, provider, profile.providerUserId, profile.email]
  );

  return user;
}

async function createUserFromOAuthProfile(profile: OAuthProfile): Promise<User> {
  const username = await buildUniqueUsername(profile.username || profile.email.split("@")[0]);
  const passwordHash = `oauth:${randomUUID()}:${randomUUID()}`;
  const [user] = await query<User>(
    `INSERT INTO users (email, password_hash, username, display_name, avatar_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [profile.email, passwordHash, username, profile.displayName, profile.avatarUrl]
  );
  return user;
}

async function deleteLocalAvatarIfAny(avatarUrl: string | null): Promise<void> {
  if (!avatarUrl || !avatarUrl.startsWith("/uploads/avatars/")) return;
  const fileName = path.basename(avatarUrl);
  const filePath = path.join(AVATAR_UPLOAD_DIR, fileName);
  try {
    await unlink(filePath);
  } catch (_error) {
    // Ignore missing files to avoid blocking profile updates.
  }
}

function isRateLimitAllowed(key: string, max: number, windowMs: number): boolean {
  return authRateLimiter.take(`auth:${key}`, { max, windowMs });
}

function getPasswordSecurityError(
  password: string,
  options?: { email?: string; username?: string; currentPassword?: string }
): string | null {
  if (password.length < 12) {
    return "La contraseña debe tener al menos 12 caracteres";
  }
  if (!/[A-Z]/.test(password)) {
    return "La contraseña debe incluir al menos una letra mayuscula";
  }
  if (!/[a-z]/.test(password)) {
    return "La contraseña debe incluir al menos una letra minuscula";
  }
  if (!/\d/.test(password)) {
    return "La contraseña debe incluir al menos un numero";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "La contraseña debe incluir al menos un caracter especial";
  }
  if (/\s/.test(password)) {
    return "La contraseña no debe contener espacios";
  }

  const lowered = password.toLowerCase();
  if (COMMON_WEAK_PASSWORDS.has(lowered)) {
    return "La contraseña es demasiado comun";
  }

  const username = options?.username?.trim().toLowerCase();
  if (username && username.length >= 3 && lowered.includes(username)) {
    return "La contraseña no puede contener tu username";
  }

  const emailLocalPart = options?.email?.split("@")[0]?.trim().toLowerCase();
  if (emailLocalPart && emailLocalPart.length >= 3 && lowered.includes(emailLocalPart)) {
    return "La contraseña no puede contener tu email";
  }

  if (options?.currentPassword && password === options.currentPassword) {
    return "La nueva contraseña no puede ser igual a la contraseña actual";
  }

  return null;
}

// ===== RUTAS =====
export async function authRoutes(app: FastifyInstance) {
  // GET /api/auth/oauth/providers - Proveedores OAuth configurados
  app.get("/api/auth/oauth/providers", async (_request, reply) => {
    return reply.send({
      providers: getConfiguredOAuthProviders().map((provider) => ({
        id: provider.id,
        label: provider.label,
      })),
    });
  });

  // GET /api/auth/oauth/:provider - Inicia el flujo OAuth 2.0
  app.get("/api/auth/oauth/:provider", async (request, reply) => {
    try {
      const providerId = (request.params as { provider?: string }).provider as OAuthProvider;
      const provider = OAUTH_PROVIDERS[providerId];
      if (!provider || !provider.clientId || !provider.clientSecret) {
        return reply.code(404).send({ error: "Proveedor OAuth no configurado" });
      }

      if (!isRateLimitAllowed(`oauth-start:${providerId}:${request.ip}`, 30, 60_000)) {
        return reply.code(429).send({ error: "Demasiados intentos OAuth. Intenta de nuevo en un minuto" });
      }

      const state = app.jwt.sign(
        {
          type: "oauth-state",
          provider: providerId,
          nonce: randomUUID(),
        },
        { expiresIn: "10m" }
      );

      const authorizeUrl = new URL(provider.authorizeUrl);
      authorizeUrl.searchParams.set("client_id", provider.clientId);
      authorizeUrl.searchParams.set("redirect_uri", getOAuthRedirectUri(request, providerId));
      authorizeUrl.searchParams.set("response_type", "code");
      authorizeUrl.searchParams.set("scope", provider.scopes.join(" "));
      authorizeUrl.searchParams.set("state", state);
      if (provider.id === "google") {
        authorizeUrl.searchParams.set("access_type", "online");
        authorizeUrl.searchParams.set("prompt", "select_account");
      }

      return reply.redirect(authorizeUrl.toString());
    } catch (error) {
      console.error("Error iniciando OAuth:", error);
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  // GET /api/auth/oauth/:provider/callback - Callback OAuth 2.0
  app.get("/api/auth/oauth/:provider/callback", async (request, reply) => {
    try {
      const providerId = (request.params as { provider?: string }).provider as OAuthProvider;
      const provider = OAUTH_PROVIDERS[providerId];
      if (!provider || !provider.clientId || !provider.clientSecret) {
        return redirectWithOAuthError(reply, "Proveedor OAuth no configurado", providerId);
      }

      const queryParams = request.query as { code?: string; state?: string; error?: string };
      if (queryParams.error) {
        return redirectWithOAuthError(reply, queryParams.error, providerId);
      }
      if (!queryParams.code || !queryParams.state) {
        return redirectWithOAuthError(reply, "Respuesta OAuth incompleta", providerId);
      }

      const state = await app.jwt.verify<{ type?: string; provider?: string }>(queryParams.state);
      if (state.type !== "oauth-state" || state.provider !== providerId) {
        return redirectWithOAuthError(reply, "Estado OAuth invalido", providerId);
      }

      if (!isRateLimitAllowed(`oauth-callback:${providerId}:${request.ip}`, 30, 60_000)) {
        return redirectWithOAuthError(reply, "Demasiados intentos OAuth", providerId);
      }

      const accessToken = await exchangeOAuthCode(
        provider,
        queryParams.code,
        getOAuthRedirectUri(request, providerId)
      );
      const profile = await fetchOAuthProfile(provider, accessToken);
      const user = await findOrCreateOAuthUser(providerId, profile);
      const token = createAuthToken(app, user);

      const redirectUrl = new URL("/oauth/callback", getFrontendOrigin());
      redirectUrl.searchParams.set("token", token);
      return reply.redirect(redirectUrl.toString());
    } catch (error) {
      console.error("Error completando OAuth:", error);
      return redirectWithOAuthError(reply, "No se pudo completar OAuth", providerId);
    }
  });

  // POST /api/auth/register - Registro de nuevo usuario
  app.post("/api/auth/register", async (request, reply) => {
    try {
      if (!isRateLimitAllowed(`register:${request.ip}`, 10, 60_000)) {
        return reply.code(429).send({ error: "Demasiadas solicitudes de registro. Intenta de nuevo en un minuto" });
      }

      // Validar datos de entrada
      const body = RegisterSchema.parse(request.body);

      const passwordError = getPasswordSecurityError(body.password, {
        email: body.email,
        username: body.username,
      });
      if (passwordError) {
        return reply.code(400).send({ error: passwordError });
      }

      // Verificar si el email ya existe
      const existingUser = await query<User>(
        "SELECT id FROM users WHERE email = $1 OR username = $2",
        [body.email, body.username]
      );

      if (existingUser.length > 0) {
        return reply.code(409).send({ error: "Email o username ya registrado" });
      }

      // Hash de la contraseña
      const passwordHash = await hashPassword(body.password);

      // Insertar usuario en la base de datos
      const [newUser] = await query<User>(
        `INSERT INTO users (email, password_hash, username) 
         VALUES ($1, $2, $3) 
         RETURNING id, email, username, created_at`,
        [body.email, passwordHash, body.username]
      );

      // Generar JWT
      const token = createAuthToken(app, newUser);

      return reply.code(201).send({
        message: "Usuario registrado exitosamente",
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          displayName: null,
          bio: null,
          avatarUrl: null,
          twoFAEnabled: false,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      console.error("Error en registro:", error);
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  // POST /api/auth/login - Inicio de sesión
  app.post("/api/auth/login", async (request, reply) => {
    try {
      if (!isRateLimitAllowed(`login:${request.ip}`, 20, 60_000)) {
        return reply.code(429).send({ error: "Demasiados intentos de login. Intenta de nuevo en un minuto" });
      }

      const body = LoginSchema.parse(request.body);

      // Buscar usuario por email
      const [user] = await query<User>(
        "SELECT * FROM users WHERE email = $1",
        [body.email]
      );

      if (!user) {
        return reply.code(401).send({ error: "Email o contraseña incorrectos" });
      }

      // Verificar contraseña
      const passwordValid = await verifyPassword(body.password, user.password_hash);
      if (!passwordValid) {
        return reply.code(401).send({ error: "Email o contraseña incorrectos" });
      }

      // Si 2FA está habilitado, verificar el token
      if (user.two_fa_enabled && user.two_fa_secret) {
        if (!body.twoFAToken) {
          return reply.code(403).send({
            error: "Se requiere código 2FA",
            requires2FA: true,
          });
        }

        const tokenValid = verify2FAToken(user.two_fa_secret, body.twoFAToken);
        if (!tokenValid) {
          return reply.code(401).send({ error: "Código 2FA inválido" });
        }
      }

      // Generar JWT
      const token = createAuthToken(app, user);

      return reply.send({
        message: "Login exitoso",
        token,
        user: toClientUser(user),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      console.error("Error en login:", error);
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  // GET /api/auth/me - Obtener información del usuario autenticado
  app.get("/api/auth/me", {
    onRequest: [app.authenticate], // Middleware de autenticación
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId;

      const [user] = await query<User>(
        "SELECT id, email, username, display_name, bio, avatar_url, two_fa_enabled, created_at FROM users WHERE id = $1",
        [userId]
      );

      if (!user) {
        return reply.code(404).send({ error: "Usuario no encontrado" });
      }

      return reply.send({ user: toClientUser(user) });
    } catch (error) {
      console.error("Error obteniendo usuario:", error);
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  // PATCH /api/auth/profile - Actualizar informacion del perfil autenticado
  app.patch("/api/auth/profile", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const body = UpdateProfileSchema.parse(request.body);
      const userId = (request.user as any).userId;

      if (!isRateLimitAllowed(`profile-update:${userId}`, 15, 60_000)) {
        return reply.code(429).send({ error: "Demasiadas actualizaciones de perfil. Intenta de nuevo en un minuto" });
      }

      const [existing] = await query<User>(
        "SELECT id FROM users WHERE username = $1 AND id <> $2",
        [body.username, userId]
      );

      if (existing) {
        return reply.code(409).send({ error: "El username ya esta en uso" });
      }

      const [updatedUser] = await query<User>(
        `UPDATE users
         SET username = $1,
             display_name = $2,
             bio = $3,
             updated_at = NOW()
         WHERE id = $4
         RETURNING id, email, username, display_name, bio, avatar_url, two_fa_enabled, created_at`,
        [
          body.username,
          body.displayName ?? null,
          body.bio ?? null,
          userId,
        ]
      );

      return reply.send({
        message: "Perfil actualizado correctamente",
        user: toClientUser(updatedUser),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      console.error("Error actualizando perfil:", error);
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  // POST /api/auth/profile/avatar - Subir avatar (solo imagenes)
  app.post("/api/auth/profile/avatar", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId;

      if (!isRateLimitAllowed(`avatar-upload:${userId}`, 8, 60_000)) {
        return reply.code(429).send({ error: "Demasiadas subidas de avatar. Intenta de nuevo en un minuto" });
      }

      const part = await request.file();
      if (!part) {
        return reply.code(400).send({ error: "No se envio ningun archivo" });
      }

      if (part.fieldname !== "avatar") {
        return reply.code(400).send({ error: "El campo de archivo debe ser avatar" });
      }

      if (!ALLOWED_AVATAR_MIME.has(part.mimetype)) {
        return reply.code(400).send({
          error: "Formato no permitido. Usa PNG, JPG, WEBP o GIF",
        });
      }

      const safeFileName = `avatar-${userId}-${Date.now()}-${randomUUID()}.webp`;
      await mkdir(AVATAR_UPLOAD_DIR, { recursive: true });
      const destinationPath = path.join(AVATAR_UPLOAD_DIR, safeFileName);

      const rawBuffer = await part.toBuffer();
      if (rawBuffer.length > MAX_AVATAR_SIZE_BYTES || part.file.truncated) {
        await unlink(destinationPath).catch(() => undefined);
        return reply.code(413).send({ error: "El archivo supera el limite de 2MB" });
      }

      await sharp(rawBuffer)
        .rotate()
        .resize(256, 256, { fit: "cover" })
        .webp({ quality: 86 })
        .toFile(destinationPath);

      const publicAvatarPath = `/uploads/avatars/${safeFileName}`;

      const [previousUser] = await query<User>(
        "SELECT avatar_url FROM users WHERE id = $1",
        [userId]
      );

      const [updatedUser] = await query<User>(
        `UPDATE users
         SET avatar_url = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, email, username, display_name, bio, avatar_url, two_fa_enabled, created_at`,
        [publicAvatarPath, userId]
      );

      await deleteLocalAvatarIfAny(previousUser?.avatar_url ?? null);

      return reply.send({
        message: "Avatar subido correctamente",
        user: toClientUser(updatedUser),
      });
    } catch (error) {
      if (error instanceof app.multipartErrors.RequestFileTooLargeError) {
        return reply.code(413).send({ error: "El archivo supera el limite de 2MB" });
      }
      console.error("Error subiendo avatar:", error);
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  // POST /api/auth/2fa/setup - Generar código QR para configurar 2FA
  app.post("/api/auth/2fa/setup", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId;
      if (!isRateLimitAllowed(`2fa-setup:${userId}`, 6, 60_000)) {
        return reply.code(429).send({ error: "Demasiadas solicitudes de configuracion 2FA" });
      }
      const email = (request.user as any).email;

      // Generar secreto 2FA
      const secret = generate2FASecret(email);

      // Guardar secreto (aún no habilitado)
      await query(
        "UPDATE users SET two_fa_secret = $1 WHERE id = $2",
        [secret.base32, userId]
      );

      // Generar QR code como Data URL (imagen base64)
      const qrCodeDataURL = await QRCode.toDataURL(secret.otpauth_url!);

      return reply.send({
        secret: secret.base32,
        qrCodeUrl: qrCodeDataURL, // Ahora es una imagen base64
      });
    } catch (error) {
      console.error("Error configurando 2FA:", error);
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  // POST /api/auth/2fa/enable - Habilitar 2FA con verificación
  app.post("/api/auth/2fa/enable", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const body = Enable2FASchema.parse(request.body);
      const userId = (request.user as any).userId;

      if (!isRateLimitAllowed(`2fa-enable:${userId}`, 12, 60_000)) {
        return reply.code(429).send({ error: "Demasiados intentos de verificacion 2FA" });
      }

      // Obtener secreto del usuario
      const [user] = await query<User>(
        "SELECT two_fa_secret FROM users WHERE id = $1",
        [userId]
      );

      if (!user || !user.two_fa_secret) {
        return reply.code(400).send({ error: "Primero configura 2FA" });
      }

      // Verificar token
      const tokenValid = verify2FAToken(user.two_fa_secret, body.token);
      if (!tokenValid) {
        return reply.code(401).send({ error: "Código 2FA inválido" });
      }

      // Habilitar 2FA
      await query(
        "UPDATE users SET two_fa_enabled = TRUE WHERE id = $1",
        [userId]
      );

      return reply.send({ message: "2FA habilitado exitosamente" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      console.error("Error habilitando 2FA:", error);
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  // POST /api/auth/2fa/disable - Deshabilitar 2FA
  app.post("/api/auth/2fa/disable", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId;

      await query(
        "UPDATE users SET two_fa_enabled = FALSE, two_fa_secret = NULL WHERE id = $1",
        [userId]
      );

      return reply.send({ message: "2FA deshabilitado" });
    } catch (error) {
      console.error("Error deshabilitando 2FA:", error);
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  // DELETE /api/auth/profile/avatar - Eliminar avatar y volver al predeterminado
  app.delete("/api/auth/profile/avatar", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId;
      if (!isRateLimitAllowed(`avatar-delete:${userId}`, 10, 60_000)) {
        return reply.code(429).send({ error: "Demasiadas eliminaciones de avatar. Intenta de nuevo en un minuto" });
      }

      const [currentUser] = await query<User>(
        "SELECT avatar_url FROM users WHERE id = $1",
        [userId]
      );

      const [updatedUser] = await query<User>(
        `UPDATE users
         SET avatar_url = NULL,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, email, username, display_name, bio, avatar_url, two_fa_enabled, created_at`,
        [userId]
      );

      await deleteLocalAvatarIfAny(currentUser?.avatar_url ?? null);

      return reply.send({
        message: "Avatar eliminado correctamente",
        user: toClientUser(updatedUser),
      });
    } catch (error) {
      console.error("Error eliminando avatar:", error);
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  // POST /api/auth/password - Cambiar contraseña del usuario autenticado
  app.post("/api/auth/password", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const body = ChangePasswordSchema.parse(request.body);
      const userId = (request.user as any).userId;

      if (!isRateLimitAllowed(`password-change:${userId}`, 8, 60_000)) {
        return reply.code(429).send({ error: "Demasiados intentos de cambio de contraseña. Intenta de nuevo en un minuto" });
      }

      const [user] = await query<User>(
        "SELECT id, email, username, password_hash FROM users WHERE id = $1",
        [userId]
      );

      if (!user) {
        return reply.code(404).send({ error: "Usuario no encontrado" });
      }

      const currentValid = await verifyPassword(body.currentPassword, user.password_hash);
      if (!currentValid) {
        return reply.code(401).send({ error: "La contraseña actual no es correcta" });
      }

      const passwordError = getPasswordSecurityError(body.newPassword, {
        email: user.email,
        username: user.username,
        currentPassword: body.currentPassword,
      });
      if (passwordError) {
        return reply.code(400).send({ error: passwordError });
      }

      const newHash = await hashPassword(body.newPassword);
      await query(
        `UPDATE users
         SET password_hash = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [newHash, userId]
      );

      return reply.send({ message: "Contraseña actualizada correctamente" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      console.error("Error cambiando contraseña:", error);
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });
}
