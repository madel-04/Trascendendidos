import { randomBytes, pbkdf2 } from 'crypto';
import { promisify } from 'util';
import speakeasy from 'speakeasy';

const pbkdf2Async = promisify(pbkdf2);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = await pbkdf2Async(password, salt, 100000, 64, 'sha512');
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, originalHash] = storedHash.split(':');
  const hash = await pbkdf2Async(password, salt, 100000, 64, 'sha512');
  return hash.toString('hex') === originalHash;
}

export function generate2FASecret(email: string) {
  return speakeasy.generateSecret({
    name: `Transcendence (${email})`,
    length: 32,
  });
}

export function verify2FAToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2,
  });
}
