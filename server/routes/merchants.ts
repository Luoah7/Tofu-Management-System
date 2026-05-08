import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db, merchants, deliveryTasks, taskItems } from '../db.js';
import { authMiddleware } from '../auth.js';
import { v4 as uuid } from 'uuid';

const merchantsRoutes = new Hono();
merchantsRoutes.use('*', authMiddleware);

// 列表
merchantsRoutes.get('/', async (c) => {
  const status = c.req.query('status');
  const where = status ? eq(merchants.status, status) : undefined;
  const list = await db.select().from(merchants).where(where);
  return c.json(list);
});

// 详情（含历史配货记录）
merchantsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const [merchant] = await db.select().from(merchants).where(eq(merchants.id, id)).limit(1);
  if (!merchant) return c.json({ error: '商户不存在' }, 404);

  // 获取该商户的已完成任务作为历史记录
  const history = await db.select().from(deliveryTasks)
    .where(and(eq(deliveryTasks.merchantId, id), eq(deliveryTasks.status, '已完成')))
    .orderBy(deliveryTasks.taskDate);

  const historyWithItems = await Promise.all(history.map(async (task) => {
    const items = await db.select().from(taskItems).where(eq(taskItems.taskId, task.id));
    return { ...task, items };
  }));

  return c.json({ ...merchant, deliveryHistory: historyWithItems });
});

// 新增
merchantsRoutes.post('/', async (c) => {
  const body = await c.req.json<any>();
  const id = `merchant_${uuid().slice(0, 8)}`;
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }).replace(/\//g, '-');

  await db.insert(merchants).values({
    id,
    name: body.name || '',
    type: body.type || '超市',
    contactName: body.contactName || '',
    phone: body.phone || '',
    address: body.address || '',
    settlementDay: body.settlementDay || '',
    discountRate: body.discountRate ?? 1,
    basketCount: body.basketCount ?? 0,
    status: '启用',
    note: body.note || '',
  });

  const [created] = await db.select().from(merchants).where(eq(merchants.id, id));
  return c.json(created, 201);
});

// 更新
merchantsRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<any>();

  await db.update(merchants).set({
    ...(body.name !== undefined && { name: body.name }),
    ...(body.type !== undefined && { type: body.type }),
    ...(body.contactName !== undefined && { contactName: body.contactName }),
    ...(body.phone !== undefined && { phone: body.phone }),
    ...(body.address !== undefined && { address: body.address }),
    ...(body.settlementDay !== undefined && { settlementDay: body.settlementDay }),
    ...(body.discountRate !== undefined && { discountRate: body.discountRate }),
    ...(body.status !== undefined && { status: body.status }),
    ...(body.note !== undefined && { note: body.note }),
    updatedAt: new Date().toISOString(),
  }).where(eq(merchants.id, id));

  const [updated] = await db.select().from(merchants).where(eq(merchants.id, id));
  return c.json(updated);
});

// 更新筐子
merchantsRoutes.put('/:id/basket', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ sent?: number; returned?: number; before?: number }>();

  const [merchant] = await db.select().from(merchants).where(eq(merchants.id, id)).limit(1);
  if (!merchant) return c.json({ error: '商户不存在' }, 404);

  const newCount = merchant.basketCount + (body.returned ?? 0) - (body.sent ?? 0);

  await db.update(merchants).set({
    basketCount: Math.max(0, newCount),
    updatedAt: new Date().toISOString(),
  }).where(eq(merchants.id, id));

  const [updated] = await db.select().from(merchants).where(eq(merchants.id, id));
  return c.json(updated);
});

// 删除（软删除 = 停用）
merchantsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await db.update(merchants).set({ status: '停用', updatedAt: new Date().toISOString() }).where(eq(merchants.id, id));
  return c.json({ ok: true });
});

export default merchantsRoutes;
