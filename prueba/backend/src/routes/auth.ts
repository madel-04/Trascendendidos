// ===== RUTAS DE AUTENTICACIÓN =====
import { FastifyInstance } from "fastify";
import { z } from "zod";
import QRCode from "qrcode";
import { query } from "../db.js";
import { hashPassword, verifyPassword, generate2FASecret, verify2FAToken } from "../utils/auth.js";

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

// ===== TIPOS =====
interface User {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  two_fa_secret: string | null;
  two_fa_enabled: boolean;
  created_at: Date;
}

// ===== RUTAS =====
export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/register - Registro de nuevo usuario
  app.post("/api/auth/register", async (request, reply) => {
    try {
      // Validar datos de entrada
      const body = RegisterSchema.parse(request.body);

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
      const token = app.jwt.sign(
        { userId: newUser.id, email: newUser.email },
        { expiresIn: "7d" }
      );

      return reply.code(201).send({
        message: "Usuario registrado exitosamente",
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
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
      const token = app.jwt.sign(
        { userId: user.id, email: user.email },
        { expiresIn: "7d" }
      );

      return reply.send({
        message: "Login exitoso",
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          twoFAEnabled: user.two_fa_enabled,
        },
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
        "SELECT id, email, username, two_fa_enabled, created_at FROM users WHERE id = $1",
        [userId]
      );

      if (!user) {
        return reply.code(404).send({ error: "Usuario no encontrado" });
      }

      return reply.send({ user });
    } catch (error) {
      console.error("Error obteniendo usuario:", error);
      return reply.code(500).send({ error: "Error interno del servidor" });
    }
  });

  // POST /api/auth/2fa/setup - Generar código QR para configurar 2FA
  app.post("/api/auth/2fa/setup", {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId;
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
}
