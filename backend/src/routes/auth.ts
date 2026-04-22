import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import QRCode from 'qrcode';
import { query } from '../db';
import { hashPassword, verifyPassword, generate2FASecret, verify2FAToken } from '../utils/auth';

const RegisterSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(50),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  twoFAToken: z.string().optional(),
});

const Enable2FASchema = z.object({
  token: z.string().length(6, '2FA code must be 6 digits'),
});

interface User {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  two_fa_secret: string | null;
  two_fa_enabled: boolean;
  created_at: Date;
}

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/register
  app.post('/api/auth/register', async (request, reply) => {
    try {
      const body = RegisterSchema.parse(request.body);

      const existingUser = await query<User>(
        'SELECT id FROM users WHERE email = $1 OR username = $2',
        [body.email, body.username]
      );
      if (existingUser.length > 0) {
        return reply.code(409).send({ error: 'Email or username already registered' });
      }

      const passwordHash = await hashPassword(body.password);
      const [newUser] = await query<User>(
        `INSERT INTO users (email, password_hash, username)
         VALUES ($1, $2, $3)
         RETURNING id, email, username, created_at`,
        [body.email, passwordHash, body.username]
      );

      const token = (app as any).jwt.sign(
        { userId: newUser.id, email: newUser.email },
        { expiresIn: '7d' }
      );

      return reply.code(201).send({
        message: 'User registered successfully',
        token,
        user: { id: newUser.id, email: newUser.email, username: newUser.username },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      console.error('Register error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/auth/login
  app.post('/api/auth/login', async (request, reply) => {
    try {
      const body = LoginSchema.parse(request.body);

      const [user] = await query<User>(
        'SELECT * FROM users WHERE email = $1',
        [body.email]
      );
      if (!user) {
        return reply.code(401).send({ error: 'Invalid email or password' });
      }

      const passwordValid = await verifyPassword(body.password, user.password_hash);
      if (!passwordValid) {
        return reply.code(401).send({ error: 'Invalid email or password' });
      }

      if (user.two_fa_enabled && user.two_fa_secret) {
        if (!body.twoFAToken) {
          return reply.code(403).send({ error: '2FA code required', requires2FA: true });
        }
        const tokenValid = verify2FAToken(user.two_fa_secret, body.twoFAToken);
        if (!tokenValid) {
          return reply.code(401).send({ error: 'Invalid 2FA code' });
        }
      }

      const token = (app as any).jwt.sign(
        { userId: user.id, email: user.email },
        { expiresIn: '7d' }
      );

      return reply.send({
        message: 'Login successful',
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
      console.error('Login error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/auth/me
  app.get('/api/auth/me', {
    onRequest: [(app as any).authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId;
      const [user] = await query<User>(
        'SELECT id, email, username, two_fa_enabled, created_at FROM users WHERE id = $1',
        [userId]
      );
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }
      return reply.send({ user });
    } catch (error) {
      console.error('Get user error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/auth/2fa/setup
  app.post('/api/auth/2fa/setup', {
    onRequest: [(app as any).authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId;
      const email = (request.user as any).email;

      const secret = generate2FASecret(email);
      await query('UPDATE users SET two_fa_secret = $1 WHERE id = $2', [secret.base32, userId]);

      const qrCodeDataURL = await QRCode.toDataURL(secret.otpauth_url!);
      return reply.send({ secret: secret.base32, qrCodeUrl: qrCodeDataURL });
    } catch (error) {
      console.error('2FA setup error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/auth/2fa/enable
  app.post('/api/auth/2fa/enable', {
    onRequest: [(app as any).authenticate],
  }, async (request, reply) => {
    try {
      const body = Enable2FASchema.parse(request.body);
      const userId = (request.user as any).userId;

      const [user] = await query<User>('SELECT two_fa_secret FROM users WHERE id = $1', [userId]);
      if (!user || !user.two_fa_secret) {
        return reply.code(400).send({ error: 'Set up 2FA first' });
      }

      const tokenValid = verify2FAToken(user.two_fa_secret, body.token);
      if (!tokenValid) {
        return reply.code(401).send({ error: 'Invalid 2FA code' });
      }

      await query('UPDATE users SET two_fa_enabled = TRUE WHERE id = $1', [userId]);
      return reply.send({ message: '2FA enabled successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors[0].message });
      }
      console.error('2FA enable error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/auth/2fa/disable
  app.post('/api/auth/2fa/disable', {
    onRequest: [(app as any).authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId;
      await query('UPDATE users SET two_fa_enabled = FALSE, two_fa_secret = NULL WHERE id = $1', [userId]);
      return reply.send({ message: '2FA disabled' });
    } catch (error) {
      console.error('2FA disable error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
