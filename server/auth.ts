import { Context, Next } from 'hono';
import { SignJWT, jwtVerify } from 'jose';
import { eq } from 'drizzle-orm';
import { db, users } from './db.js';
import { getJwtSecret } from './config.js';

const JWT_SECRET = new TextEncoder().encode(getJwtSecret());

export async function signToken(payload: { userId: string; username: string; role: string }) {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as { userId: string; username: string; role: string };
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: '未登录' }, 401);
  }
  try {
    const token = authHeader.slice(7);
    const payload = await verifyToken(token);
    c.set('user', payload);
    await next();
  } catch {
    return c.json({ error: '登录已过期' }, 401);
  }
}

export function getUser(c: Context) {
  return c.get('user') as { userId: string; username: string; role: string };
}
