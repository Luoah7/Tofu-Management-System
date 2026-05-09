import { and, eq, inArray } from 'drizzle-orm';
import { db, appSettings, deliveryTasks, taskItems } from '../db.js';
import { getTaskItemSettings, normalizeTaskItemInput, setTaskItemSettings } from '../../src/shared/task-item.js';

const BASKET_WEIGHT_KEY = 'basket_weight_jin';

function parsePositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 10) / 10 : fallback;
}

export async function loadTaskItemSettings() {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, BASKET_WEIGHT_KEY)).limit(1);
  const current = getTaskItemSettings();
  return setTaskItemSettings({
    basketWeightJin: parsePositiveNumber(row?.value, current.basketWeightJin),
  });
}

export async function saveTaskItemSettings(input: { basketWeightJin: number }) {
  const next = setTaskItemSettings({
    basketWeightJin: parsePositiveNumber(input.basketWeightJin, getTaskItemSettings().basketWeightJin),
  });

  await db.insert(appSettings)
    .values({
      key: BASKET_WEIGHT_KEY,
      value: String(next.basketWeightJin),
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: String(next.basketWeightJin),
        updatedAt: new Date().toISOString(),
      },
    });

  await recalculatePendingBasketWeights();
  return next;
}

export async function recalculatePendingBasketWeights() {
  const pendingTasks = await db.select().from(deliveryTasks).where(inArray(deliveryTasks.status, ['待配货', '待复秤']));
  if (pendingTasks.length === 0) return;

  const pendingTaskIds = pendingTasks.map(task => task.id);
  const basketItems = await db.select().from(taskItems).where(and(
    inArray(taskItems.taskId, pendingTaskIds),
    eq(taskItems.displayUnit, '筐'),
  ));

  for (const item of basketItems) {
    const normalized = normalizeTaskItemInput({
      displayAmount: item.displayAmount,
      displayUnit: item.displayUnit,
    });
    await db.update(taskItems)
      .set({ plannedWeight: normalized.plannedWeight })
      .where(eq(taskItems.id, item.id));
  }

  for (const task of pendingTasks) {
    const items = await db.select().from(taskItems).where(eq(taskItems.taskId, task.id));
    const plannedWeight = items.reduce((sum, item) => sum + item.plannedWeight, 0);
    await db.update(deliveryTasks)
      .set({ plannedWeight, updatedAt: new Date().toISOString() })
      .where(eq(deliveryTasks.id, task.id));
  }
}
