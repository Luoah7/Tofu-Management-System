import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db, users } from '../db.js';
import { signToken, authMiddleware, getUser } from '../auth.js';
import { v4 as uuid } from 'uuid';

const auth = new Hono();

auth.post('/login', async (c) => {
  const { username, password } = await c.req.json<{ username: string; password: string }>();

  if (!username || !password) {
    return c.json({ error: '请输入手机号和密码' }, 400);
  }

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user) {
    return c.json({ error: '用户名或密码错误' }, 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: '用户名或密码错误' }, 401);
  }

  const token = await signToken({ userId: user.id, username: user.username, role: user.role });

  return c.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  });
});

auth.get('/me', authMiddleware, async (c) => {
  const payload = getUser(c);
  const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
  if (!user) {
    return c.json({ error: '用户不存在' }, 404);
  }
  return c.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  });
});

export default auth;
