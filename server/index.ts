import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from '@hono/node-server/serve-static';
import path from 'path';
import fs from 'fs';
import { initDatabase } from './db.js';
import { getTaskPhotoPath } from './uploads.js';
import authRoutes from './routes/auth.js';
import merchantsRoutes from './routes/merchants.js';
import productsRoutes from './routes/products.js';
import tasksRoutes from './routes/tasks.js';
import settlementsRoutes from './routes/settlements.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('/api/*', cors());

// API routes
app.route('/api/auth', authRoutes);
app.route('/api/merchants', merchantsRoutes);
app.route('/api/products', productsRoutes);
app.route('/api/tasks', tasksRoutes);
app.route('/api/settlements', settlementsRoutes);

// Receipt endpoint (inline, simple)
app.get('/api/receipts/:taskId', async (c) => {
  // Dynamic import to avoid circular deps
  const { db, deliveryTasks, taskItems, merchants } = await import('./db.js');
  const { eq } = await import('drizzle-orm');

  const taskId = c.req.param('taskId');
  const [task] = await db.select().from(deliveryTasks).where(eq(deliveryTasks.id, taskId)).limit(1);
  if (!task) return c.json({ error: '任务不存在' }, 404);

  const items = await db.select().from(taskItems).where(eq(taskItems.taskId, taskId));
  const [merchant] = await db.select().from(merchants).where(eq(merchants.id, task.merchantId)).limit(1);

  const receiptNo = `TH${task.taskDate.replace(/-/g, '')}${taskId.slice(-4)}`;

  return c.json({
    merchantName: task.merchantName,
    merchantAddress: task.address,
    items: items.map(item => ({
      name: item.productName,
      spec: item.specLabel,
      weight: item.actualWeight > 0 ? item.actualWeight : item.plannedWeight,
      unitPrice: item.unitPrice,
      subtotal: (item.actualWeight > 0 ? item.actualWeight : item.plannedWeight) * item.unitPrice,
    })),
    totalAmount: items.reduce((sum, item) => {
      const w = item.actualWeight > 0 ? item.actualWeight : item.plannedWeight;
      return sum + w * item.unitPrice;
    }, 0),
    operator: task.operator,
    date: task.taskDate,
    receiptNo,
  });
});

// Public merchant bill (no auth required)
app.get('/api/public/merchants/:id/bill', async (c) => {
  const { db, merchants, deliveryTasks, taskItems, settlements, settlementItems } = await import('./db.js');
  const { eq, and } = await import('drizzle-orm');

  const id = c.req.param('id');
  const [merchant] = await db.select().from(merchants).where(eq(merchants.id, id)).limit(1);
  if (!merchant) return c.json({ error: '商户不存在' }, 404);

  // 获取已完成的任务
  const tasks = await db.select().from(deliveryTasks)
    .where(and(eq(deliveryTasks.merchantId, id), eq(deliveryTasks.status, '已完成')));

  const history = await Promise.all(tasks.map(async (task) => {
    const items = await db.select().from(taskItems).where(eq(taskItems.taskId, task.id));
    return { ...task, items };
  }));

  // 获取结算单
  const stls = await db.select().from(settlements).where(eq(settlements.merchantId, id));
  const stlsWithItems = await Promise.all(stls.map(async (stl) => {
    const items = await db.select().from(settlementItems).where(eq(settlementItems.settlementId, stl.id));
    return { ...stl, items };
  }));

  const pendingAmount = stlsWithItems
    .filter(s => s.payStatus !== '已收款')
    .reduce((sum, s) => sum + s.totalAmount - s.paidAmount, 0);

  const settledAmount = stlsWithItems
    .filter(s => s.payStatus === '已收款')
    .reduce((sum, s) => sum + s.totalAmount, 0);

  return c.json({
    merchant: {
      id: merchant.id,
      name: merchant.name,
      type: merchant.type,
      address: merchant.address,
      phone: merchant.phone,
      settlementDay: merchant.settlementDay,
      basketCount: merchant.basketCount,
    },
    pendingAmount,
    settledAmount,
    deliveryHistory: history.map(t => ({
      id: t.id,
      date: t.taskDate,
      totalAmount: t.items.reduce((s, i) => s + (i.actualWeight > 0 ? i.actualWeight : i.plannedWeight) * i.unitPrice, 0),
      items: t.items.map(i => ({
        name: i.productName,
        specLabel: i.specLabel,
        weight: i.actualWeight > 0 ? i.actualWeight : i.plannedWeight,
        unitPrice: i.unitPrice,
        subtotal: (i.actualWeight > 0 ? i.actualWeight : i.plannedWeight) * i.unitPrice,
      })),
    })),
    settlements: stlsWithItems.map(s => ({
      id: s.id,
      periodStart: s.periodStart,
      periodEnd: s.periodEnd,
      totalAmount: s.totalAmount,
      paidAmount: s.paidAmount,
      payStatus: s.payStatus,
    })),
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(process.cwd(), 'dist/client');
  if (fs.existsSync(distPath)) {
    app.use('/*', serveStatic({ root: './dist/client' }));
    // SPA fallback
    app.get('*', (c) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        const html = fs.readFileSync(indexPath, 'utf-8');
        return c.html(html);
      }
      return c.notFound();
    });
  }
}

// Initialize database and start server
const PORT = parseInt(process.env.PORT || '3000');

initDatabase();

serve({
  fetch: app.fetch,
  port: PORT,
}, (info) => {
  console.log(`Server running at http://localhost:${info.port}`);
});
app.get('/uploads/tasks/:taskId/:fileName', async (c) => {
  const taskId = c.req.param('taskId');
  const fileName = c.req.param('fileName');
  const photoPath = getTaskPhotoPath(taskId, fileName);

  if (!fs.existsSync(photoPath)) {
    return c.notFound();
  }

  const ext = path.extname(fileName).toLowerCase();
  const contentType = ext === '.png'
    ? 'image/png'
    : ext === '.webp'
      ? 'image/webp'
      : ext === '.heic'
        ? 'image/heic'
        : 'image/jpeg';

  return c.body(fs.readFileSync(photoPath), 200, {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
});
