import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db, settlements, settlementItems, deliveryTasks, taskItems, merchants } from '../db.js';
import { authMiddleware } from '../auth.js';
import { v4 as uuid } from 'uuid';

const settlementsRoutes = new Hono();
settlementsRoutes.use('*', authMiddleware);

// 列表
settlementsRoutes.get('/', async (c) => {
  const merchantId = c.req.query('merchant_id');
  const payStatus = c.req.query('pay_status');
  const conditions = [];
  if (merchantId) conditions.push(eq(settlements.merchantId, merchantId));
  if (payStatus) conditions.push(eq(settlements.payStatus, payStatus));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const list = await db.select().from(settlements).where(where).orderBy(settlements.createdAt);

  const result = await Promise.all(list.map(async (stl) => {
    const items = await db.select().from(settlementItems).where(eq(settlementItems.settlementId, stl.id));
    return { ...stl, items };
  }));

  return c.json(result);
});

// 详情
settlementsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const [stl] = await db.select().from(settlements).where(eq(settlements.id, id)).limit(1);
  if (!stl) return c.json({ error: '结算单不存在' }, 404);

  const items = await db.select().from(settlementItems).where(eq(settlementItems.settlementId, id));
  return c.json({ ...stl, items });
});

// 生成结算单
settlementsRoutes.post('/generate', async (c) => {
  const { merchantId, periodStart, periodEnd, operator } = await c.req.json<{
    merchantId: string; periodStart: string; periodEnd: string; operator?: string;
  }>();

  // 查找该商户在账期内的已完成任务
  const tasks = await db.select().from(deliveryTasks).where(
    and(
      eq(deliveryTasks.merchantId, merchantId),
      eq(deliveryTasks.status, '已完成'),
    )
  );

  const filteredTasks = tasks.filter(t => t.taskDate >= periodStart && t.taskDate <= periodEnd);

  if (filteredTasks.length === 0) {
    return c.json({ error: '该账期内没有已完成的配货任务' }, 400);
  }

  // 获取商户信息
  const [merchant] = await db.select().from(merchants).where(eq(merchants.id, merchantId)).limit(1);
  if (!merchant) return c.json({ error: '商户不存在' }, 404);

  const stlId = `stl_${uuid().slice(0, 8)}`;
  let totalAmount = 0;

  // 先计算总金额
  const allItems: Array<{ task: typeof filteredTasks[0]; item: any; subtotal: number }> = [];
  for (const task of filteredTasks) {
    const items = await db.select().from(taskItems).where(eq(taskItems.taskId, task.id));
    for (const item of items) {
      const subtotal = item.actualWeight > 0
        ? item.actualWeight * item.unitPrice
        : item.plannedWeight * item.unitPrice;
      totalAmount += subtotal;
      allItems.push({ task, item, subtotal });
    }
  }

  // 折扣
  totalAmount = Math.round(totalAmount * merchant.discountRate * 100) / 100;

  // 先插入结算单（满足外键约束）
  await db.insert(settlements).values({
    id: stlId,
    merchantId,
    merchantName: merchant.name,
    periodStart,
    periodEnd,
    totalAmount,
    operator: operator || '',
  });

  // 再插入明细
  for (const { task, item, subtotal } of allItems) {
    await db.insert(settlementItems).values({
      id: `si_${uuid().slice(0, 8)}`,
      settlementId: stlId,
      taskId: task.id,
      taskDate: task.taskDate,
      productName: item.productName,
      specLabel: item.specLabel,
      weight: item.actualWeight > 0 ? item.actualWeight : item.plannedWeight,
      unitPrice: item.unitPrice,
      subtotal,
    });
  }

  const [stl] = await db.select().from(settlements).where(eq(settlements.id, stlId));
  const stlItems = await db.select().from(settlementItems).where(eq(settlementItems.settlementId, stlId));
  return c.json({ ...stl, items: stlItems }, 201);
});

// 更新收款状态
settlementsRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ payStatus?: string; payMethod?: string; paidAmount?: number; note?: string }>();

  await db.update(settlements).set({
    ...(body.payStatus !== undefined && { payStatus: body.payStatus }),
    ...(body.payMethod !== undefined && { payMethod: body.payMethod }),
    ...(body.paidAmount !== undefined && { paidAmount: body.paidAmount }),
    ...(body.note !== undefined && { note: body.note }),
    updatedAt: new Date().toISOString(),
  }).where(eq(settlements.id, id));

  const [updated] = await db.select().from(settlements).where(eq(settlements.id, id));
  const items = await db.select().from(settlementItems).where(eq(settlementItems.settlementId, id));
  return c.json({ ...updated, items });
});

// 删除
settlementsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await db.delete(settlementItems).where(eq(settlementItems.settlementId, id));
  await db.delete(settlements).where(eq(settlements.id, id));
  return c.json({ ok: true });
});

export default settlementsRoutes;
