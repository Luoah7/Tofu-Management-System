import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { db, deliveryTasks, taskItems, taskPhotos, merchants, products as productsTable, productSpecs } from '../db.js';
import { authMiddleware } from '../auth.js';
import { parseWeChatText, matchProduct } from '../utils/wechat-parser.js';
import { v4 as uuid } from 'uuid';
import { getTaskPhotoPath, getTaskPhotoUrl, removeTaskPhoto } from '../uploads.js';

const tasksRoutes = new Hono();
tasksRoutes.use('*', authMiddleware);

function getPhotoExtension(file: File) {
  const ext = path.extname(file.name || '').toLowerCase();
  if (ext) return ext;
  if (file.type === 'image/png') return '.png';
  if (file.type === 'image/webp') return '.webp';
  if (file.type === 'image/heic') return '.heic';
  return '.jpg';
}

async function listTaskPhotos(taskId: string) {
  const photos = await db.select().from(taskPhotos).where(eq(taskPhotos.taskId, taskId)).orderBy(taskPhotos.createdAt);
  return photos.map(photo => ({
    ...photo,
    url: getTaskPhotoUrl(taskId, photo.fileName),
  }));
}

// 列表
tasksRoutes.get('/', async (c) => {
  const date = c.req.query('date');
  const status = c.req.query('status');
  const conditions = [];
  if (date) conditions.push(eq(deliveryTasks.taskDate, date));
  if (status) conditions.push(eq(deliveryTasks.status, status));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const tasks = await db.select().from(deliveryTasks).where(where).orderBy(deliveryTasks.createdAt);

  const result = await Promise.all(tasks.map(async (task) => {
    const items = await db.select().from(taskItems).where(eq(taskItems.taskId, task.id));
    return { ...task, items };
  }));

  return c.json(result);
});

// 统计
tasksRoutes.get('/stats', async (c) => {
  const date = c.req.query('date') || new Date().toISOString().slice(0, 10);

  const allTasks = await db.select().from(deliveryTasks).where(eq(deliveryTasks.taskDate, date));

  const stats = {
    total: allTasks.length,
    pendingWeigh: allTasks.filter(t => t.status === '待配货' || t.status === '待复秤').length,
    pendingPhoto: allTasks.filter(t => t.status === '待拍照').length,
    pendingDelivery: allTasks.filter(t => t.status === '待送达').length,
    completed: allTasks.filter(t => t.status === '已完成').length,
    exception: allTasks.filter(t => t.status === '异常').length,
    totalPlannedWeight: allTasks.reduce((s, t) => s + t.plannedWeight, 0),
    totalActualWeight: allTasks.reduce((s, t) => s + t.actualWeight, 0),
  };

  return c.json(stats);
});

// 详情
tasksRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const [task] = await db.select().from(deliveryTasks).where(eq(deliveryTasks.id, id)).limit(1);
  if (!task) return c.json({ error: '任务不存在' }, 404);

  const items = await db.select().from(taskItems).where(eq(taskItems.taskId, id));
  const photos = await listTaskPhotos(id);
  return c.json({ ...task, items, photos });
});

// 新建任务
tasksRoutes.post('/', async (c) => {
  const body = await c.req.json<any>();
  const id = `task_${uuid().slice(0, 8)}`;
  const today = new Date().toISOString().slice(0, 10);

  await db.insert(deliveryTasks).values({
    id,
    taskDate: body.taskDate || today,
    merchantId: body.merchantId,
    merchantName: body.merchantName || '',
    merchantType: body.merchantType || '',
    address: body.address || '',
    phone: body.phone || '',
    routeEta: body.routeEta || '',
    status: '待配货',
    settlementDay: body.settlementDay || '',
    plannedWeight: body.items?.reduce((s: number, i: any) => s + (i.plannedWeight || 0), 0) || 0,
    operator: body.operator || '',
  });

  if (body.items) {
    for (const item of body.items) {
      await db.insert(taskItems).values({
        id: `ti_${uuid().slice(0, 8)}`,
        taskId: id,
        productId: item.productId || '',
        specId: item.specId || '',
        productName: item.name || item.productName || '',
        specLabel: item.specLabel || '',
        unitPrice: item.unitPrice || 0,
        quantity: item.quantity || 1,
        plannedWeight: item.plannedWeight || 0,
      });
    }
  }

  const [created] = await db.select().from(deliveryTasks).where(eq(deliveryTasks.id, id));
  const items = await db.select().from(taskItems).where(eq(taskItems.taskId, id));
  return c.json({ ...created, items }, 201);
});

// 微信文本解析生成任务
tasksRoutes.post('/parse-wechat', async (c) => {
  const { text, date } = await c.req.json<{ text: string; date?: string }>();
  const taskDate = date || new Date().toISOString().slice(0, 10);

  const parsed = parseWeChatText(text);
  if (parsed.length === 0) {
    return c.json({ error: '未能解析出有效订单，请检查格式', parsed: [] }, 400);
  }

  // 获取商户和商品数据用于匹配
  const allMerchants = await db.select().from(merchants);
  const allProducts = await db.select().from(productsTable);
  const allSpecs = await db.select().from(productSpecs);
  const productsWithSpecs = allProducts.map(p => ({
    ...p,
    specs: allSpecs.filter(s => s.productId === p.id),
  }));

  const createdTasks = [];

  for (const order of parsed) {
    // 匹配商户
    const merchant = allMerchants.find(m =>
      order.merchantName.includes(m.name) || m.name.includes(order.merchantName)
    );

    const items = [];
    let totalWeight = 0;

    for (const item of order.items) {
      const matched = matchProduct(item.name, productsWithSpecs);
      if (matched) {
        items.push({
          productId: matched.productId,
          specId: matched.specId,
          name: matched.name,
          specLabel: matched.specLabel,
          unitPrice: matched.unitPrice,
          plannedWeight: item.weight,
        });
        totalWeight += item.weight;
      }
    }

    if (items.length === 0) continue;

    const taskId = `task_${uuid().slice(0, 8)}`;

    await db.insert(deliveryTasks).values({
      id: taskId,
      taskDate,
      merchantId: merchant?.id || '',
      merchantName: merchant?.name || order.merchantName,
      merchantType: merchant?.type || '',
      address: merchant?.address || '',
      phone: merchant?.phone || '',
      settlementDay: merchant?.settlementDay || '',
      status: '待配货',
      plannedWeight: totalWeight,
    });

    for (const item of items) {
      await db.insert(taskItems).values({
        id: `ti_${uuid().slice(0, 8)}`,
        taskId,
        productId: item.productId,
        specId: item.specId,
        productName: item.name,
        specLabel: item.specLabel,
        unitPrice: item.unitPrice,
        plannedWeight: item.plannedWeight,
      });
    }

    const [task] = await db.select().from(deliveryTasks).where(eq(deliveryTasks.id, taskId));
    const taskItemsList = await db.select().from(taskItems).where(eq(taskItems.taskId, taskId));
    createdTasks.push({ ...task, items: taskItemsList });
  }

  return c.json(createdTasks, 201);
});

// 更新任务
tasksRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<any>();

  await db.update(deliveryTasks).set({
    ...(body.status !== undefined && { status: body.status }),
    ...(body.operator !== undefined && { operator: body.operator }),
    ...(body.routeEta !== undefined && { routeEta: body.routeEta }),
    ...(body.note !== undefined && { note: body.note }),
    updatedAt: new Date().toISOString(),
  }).where(eq(deliveryTasks.id, id));

  const [updated] = await db.select().from(deliveryTasks).where(eq(deliveryTasks.id, id));
  const items = await db.select().from(taskItems).where(eq(taskItems.taskId, id));
  const photos = await listTaskPhotos(id);
  return c.json({ ...updated, items, photos });
});

// 复秤
tasksRoutes.put('/:id/weigh', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ actualWeight: number; items?: Array<{ id: string; actualWeight: number }> }>();

  await db.update(deliveryTasks).set({
    actualWeight: body.actualWeight,
    status: '待拍照',
    updatedAt: new Date().toISOString(),
  }).where(eq(deliveryTasks.id, id));

  if (body.items) {
    for (const item of body.items) {
      await db.update(taskItems).set({ actualWeight: item.actualWeight }).where(eq(taskItems.id, item.id));
    }
  }

  const [updated] = await db.select().from(deliveryTasks).where(eq(deliveryTasks.id, id));
  const items = await db.select().from(taskItems).where(eq(taskItems.taskId, id));
  const photos = await listTaskPhotos(id);
  return c.json({ ...updated, items, photos });
});

// 拍照
tasksRoutes.put('/:id/photo', async (c) => {
  const id = c.req.param('id');
  const contentType = c.req.header('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await c.req.formData();
    const files = form.getAll('photos').filter((file): file is File => file instanceof File && file.size > 0);

    if (files.length === 0) {
      return c.json({ error: '请先选择照片' }, 400);
    }

    const existing = await db.select().from(taskPhotos).where(eq(taskPhotos.taskId, id));
    for (const photo of existing) {
      removeTaskPhoto(id, photo.fileName);
    }
    await db.delete(taskPhotos).where(eq(taskPhotos.taskId, id));

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        return c.json({ error: '只能上传图片' }, 400);
      }

      const fileName = `${uuid()}${getPhotoExtension(file)}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(getTaskPhotoPath(id, fileName), bytes);

      await db.insert(taskPhotos).values({
        id: `photo_${uuid().slice(0, 8)}`,
        taskId: id,
        fileName,
        originalName: file.name || fileName,
        mimeType: file.type || 'image/jpeg',
        fileSize: file.size,
      });
    }

    await db.update(deliveryTasks).set({
      photoCount: files.length,
      status: '待送达',
      updatedAt: new Date().toISOString(),
    }).where(eq(deliveryTasks.id, id));

    const [updated] = await db.select().from(deliveryTasks).where(eq(deliveryTasks.id, id));
    const photos = await listTaskPhotos(id);
    return c.json({ ...updated, photos });
  }

  const body = await c.req.json<{ photoCount: number }>();

  await db.update(deliveryTasks).set({
    photoCount: body.photoCount,
    status: '待送达',
    updatedAt: new Date().toISOString(),
  }).where(eq(deliveryTasks.id, id));

  const [updated] = await db.select().from(deliveryTasks).where(eq(deliveryTasks.id, id));
  const photos = await listTaskPhotos(id);
  return c.json({ ...updated, photos });
});

// 完成
tasksRoutes.put('/:id/complete', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ signMethod: string; note?: string }>();

  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }).replace(/\//g, '-');

  await db.update(deliveryTasks).set({
    signMethod: body.signMethod || '现场确认',
    note: body.note || '',
    status: '已完成',
    completedAt: now,
    updatedAt: new Date().toISOString(),
  }).where(eq(deliveryTasks.id, id));

  const [updated] = await db.select().from(deliveryTasks).where(eq(deliveryTasks.id, id));
  const items = await db.select().from(taskItems).where(eq(taskItems.taskId, id));
  const photos = await listTaskPhotos(id);
  return c.json({ ...updated, items, photos });
});

// 异常
tasksRoutes.put('/:id/exception', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ exceptionReason: string; exceptionNote?: string }>();

  await db.update(deliveryTasks).set({
    exceptionReason: body.exceptionReason,
    exceptionNote: body.exceptionNote || '',
    status: '异常',
    updatedAt: new Date().toISOString(),
  }).where(eq(deliveryTasks.id, id));

  const [updated] = await db.select().from(deliveryTasks).where(eq(deliveryTasks.id, id));
  return c.json(updated);
});

// 更新筐子
tasksRoutes.put('/:id/basket', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ beforeBasketCount?: number; sentBasketCount?: number; returnedBasketCount?: number }>();

  await db.update(deliveryTasks).set({
    ...(body.beforeBasketCount !== undefined && { beforeBasketCount: body.beforeBasketCount }),
    ...(body.sentBasketCount !== undefined && { sentBasketCount: body.sentBasketCount }),
    ...(body.returnedBasketCount !== undefined && { returnedBasketCount: body.returnedBasketCount }),
    updatedAt: new Date().toISOString(),
  }).where(eq(deliveryTasks.id, id));

  const [updated] = await db.select().from(deliveryTasks).where(eq(deliveryTasks.id, id));
  return c.json(updated);
});

export default tasksRoutes;
