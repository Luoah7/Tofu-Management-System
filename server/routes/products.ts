import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db, products, productSpecs } from '../db.js';
import { authMiddleware } from '../auth.js';
import { v4 as uuid } from 'uuid';

const productsRoutes = new Hono();
productsRoutes.use('*', authMiddleware);

// 列表（含规格）
productsRoutes.get('/', async (c) => {
  const list = await db.select().from(products);
  const specs = await db.select().from(productSpecs);

  const result = list.map(p => ({
    ...p,
    specs: specs.filter(s => s.productId === p.id).sort((a, b) => a.sortOrder - b.sortOrder),
  }));

  return c.json(result);
});

// 新增商品
productsRoutes.post('/', async (c) => {
  const body = await c.req.json<{ name: string; category: string; specs?: Array<{ label: string; unitPrice: number }> }>();
  const id = `prod_${uuid().slice(0, 8)}`;

  await db.insert(products).values({ id, name: body.name, category: body.category || '' });

  if (body.specs) {
    for (let i = 0; i < body.specs.length; i++) {
      await db.insert(productSpecs).values({
        id: `spec_${uuid().slice(0, 8)}`,
        productId: id,
        label: body.specs[i].label,
        unitPrice: body.specs[i].unitPrice,
        sortOrder: i,
      });
    }
  }

  const specs = await db.select().from(productSpecs).where(eq(productSpecs.productId, id));
  const [created] = await db.select().from(products).where(eq(products.id, id));
  return c.json({ ...created, specs }, 201);
});

// 更新商品
productsRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<any>();

  await db.update(products).set({
    ...(body.name !== undefined && { name: body.name }),
    ...(body.category !== undefined && { category: body.category }),
    ...(body.status !== undefined && { status: body.status }),
  }).where(eq(products.id, id));

  const [updated] = await db.select().from(products).where(eq(products.id, id));
  const specs = await db.select().from(productSpecs).where(eq(productSpecs.productId, id));
  return c.json({ ...updated, specs });
});

// 新增规格
productsRoutes.post('/:id/specs', async (c) => {
  const productId = c.req.param('id');
  const body = await c.req.json<{ label: string; unitPrice: number }>();

  const id = `spec_${uuid().slice(0, 8)}`;
  await db.insert(productSpecs).values({ id, productId, label: body.label, unitPrice: body.unitPrice });

  const [created] = await db.select().from(productSpecs).where(eq(productSpecs.id, id));
  return c.json(created, 201);
});

// 更新规格
productsRoutes.put('/spec/:specId', async (c) => {
  const specId = c.req.param('specId');
  const body = await c.req.json<any>();

  await db.update(productSpecs).set({
    ...(body.label !== undefined && { label: body.label }),
    ...(body.unitPrice !== undefined && { unitPrice: body.unitPrice }),
    ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
  }).where(eq(productSpecs.id, specId));

  const [updated] = await db.select().from(productSpecs).where(eq(productSpecs.id, specId));
  return c.json(updated);
});

// 删除规格
productsRoutes.delete('/spec/:specId', async (c) => {
  const specId = c.req.param('specId');
  await db.delete(productSpecs).where(eq(productSpecs.id, specId));
  return c.json({ ok: true });
});

export default productsRoutes;
