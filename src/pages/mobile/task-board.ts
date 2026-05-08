export const PENDING_GROUP_ORDER = ['待配货', '待复秤', '待送达'] as const;

export type PendingGroupKey = (typeof PENDING_GROUP_ORDER)[number];

export function groupPendingTasks<T extends { status: string }>(tasks: T[]) {
  return PENDING_GROUP_ORDER.map((status) => ({
    status,
    tasks: tasks.filter(task => task.status === status),
  })).filter(group => group.tasks.length > 0);
}
