import { Hono } from 'hono';
import { authMiddleware } from '../auth.js';
import { getTaskItemSettings } from '../../src/shared/task-item.js';
import { saveTaskItemSettings } from '../utils/app-settings.js';

const settingsRoutes = new Hono();
settingsRoutes.use('*', authMiddleware);

settingsRoutes.get('/task-items', (c) => {
  return c.json(getTaskItemSettings());
});

settingsRoutes.put('/task-items', async (c) => {
  const body = await c.req.json<{ basketWeightJin?: number }>();
  const basketWeightJin = Number(body.basketWeightJin);
  if (!Number.isFinite(basketWeightJin) || basketWeightJin <= 0) {
    return c.json({ error: '一筐默认斤数必须大于 0' }, 400);
  }

  const settings = await saveTaskItemSettings({ basketWeightJin });
  return c.json(settings);
});

export default settingsRoutes;
