export const TASK_ITEM_UNITS = ['斤', '公斤', '筐'] as const;

export type TaskItemUnit = (typeof TASK_ITEM_UNITS)[number];

export const PENDING_STATUS_ORDER = ['待配货', '待复秤', '待送达'] as const;

const KG_TO_JIN = 2;
const DEFAULT_BASKET_WEIGHT_JIN = 12;
let basketWeightJin = DEFAULT_BASKET_WEIGHT_JIN;

function roundToSingleDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(roundToSingleDecimal(value));
}

export function normalizeTaskItemUnit(unit?: string): TaskItemUnit {
  if (unit === '公斤' || unit === '筐') return unit;
  return '斤';
}

function normalizeBasketWeightJin(value: number) {
  const normalized = roundToSingleDecimal(Number(value) || 0);
  return normalized > 0 ? normalized : DEFAULT_BASKET_WEIGHT_JIN;
}

export function getTaskItemSettings() {
  return {
    basketWeightJin,
  };
}

export function setTaskItemSettings(settings: { basketWeightJin?: number }) {
  if (settings.basketWeightJin !== undefined) {
    basketWeightJin = normalizeBasketWeightJin(settings.basketWeightJin);
  }
  return getTaskItemSettings();
}

export function normalizeTaskItemInput(input: { displayAmount: number; displayUnit?: string }) {
  const displayUnit = normalizeTaskItemUnit(input.displayUnit);
  const displayAmount = roundToSingleDecimal(Math.max(0, Number(input.displayAmount) || 0));
  const plannedWeight = displayUnit === '公斤'
    ? roundToSingleDecimal(displayAmount * KG_TO_JIN)
    : displayUnit === '筐'
      ? roundToSingleDecimal(displayAmount * basketWeightJin)
      : displayAmount;

  return {
    displayAmount,
    displayUnit,
    plannedWeight,
  };
}

export function resolveTaskItemMeasure(input: { plannedWeight: number; displayAmount?: number; displayUnit?: string }) {
  const displayUnit = normalizeTaskItemUnit(input.displayUnit);
  const hasDisplayAmount = Number.isFinite(input.displayAmount) && Number(input.displayAmount) > 0;

  return {
    displayAmount: hasDisplayAmount ? roundToSingleDecimal(Number(input.displayAmount)) : roundToSingleDecimal(Number(input.plannedWeight) || 0),
    displayUnit,
  };
}

export function formatTaskItemMeasure(amount: number, unit?: string) {
  return `${formatNumber(Number(amount) || 0)}${normalizeTaskItemUnit(unit)}`;
}

export function getTaskItemStep(unit?: string) {
  return normalizeTaskItemUnit(unit) === '筐' ? 1 : 0.5;
}

export function getTaskItemMin(unit?: string) {
  return normalizeTaskItemUnit(unit) === '筐' ? 1 : 0.5;
}

export function comparePendingTasks<T extends { taskDate: string; status: string; createdAt?: string; merchantName?: string }>(a: T, b: T) {
  if (a.taskDate !== b.taskDate) {
    return a.taskDate.localeCompare(b.taskDate);
  }

  const statusDelta = PENDING_STATUS_ORDER.indexOf(a.status as (typeof PENDING_STATUS_ORDER)[number])
    - PENDING_STATUS_ORDER.indexOf(b.status as (typeof PENDING_STATUS_ORDER)[number]);
  if (statusDelta !== 0) return statusDelta;

  if (a.createdAt && b.createdAt && a.createdAt !== b.createdAt) {
    return a.createdAt.localeCompare(b.createdAt);
  }

  return (a.merchantName || '').localeCompare(b.merchantName || '', 'zh-CN');
}
