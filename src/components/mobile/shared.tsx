import React from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Package,
  Scale,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { formatWeight } from '@/utils/format';

type StatusTone = 'blue' | 'amber' | 'orange' | 'green' | 'red' | 'slate';

type StatusMeta = {
  icon: LucideIcon;
  tone: StatusTone;
};

const FALLBACK_STATUS: StatusMeta = {
  icon: Package,
  tone: 'slate',
};

export const STATUS_META: Record<string, StatusMeta> = {
  待配货: { icon: Package, tone: 'slate' },
  待复秤: { icon: Scale, tone: 'blue' },
  待拍照: { icon: Camera, tone: 'amber' },
  待送达: { icon: Truck, tone: 'orange' },
  已完成: { icon: CheckCircle2, tone: 'green' },
  异常: { icon: AlertTriangle, tone: 'red' },
};

export function getStatusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? FALLBACK_STATUS;
}

type StatusBadgeProps = {
  status: string;
  className?: string;
};

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const meta = getStatusMeta(status);
  const Icon = meta.icon;

  return (
    <span className={`status-badge status-badge--${meta.tone} ${className}`.trim()}>
      <Icon size={14} />
      <span>{status}</span>
    </span>
  );
}

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  extra?: React.ReactNode;
};

export function SectionHeading({ eyebrow, title, extra }: SectionHeadingProps) {
  return (
    <div className="mobile-section-heading mobile-rise">
      <div>
        {eyebrow ? <div className="mobile-section-heading__eyebrow">{eyebrow}</div> : null}
        <div className="mobile-section-heading__title">{title}</div>
      </div>
      {extra ? <div className="mobile-section-heading__extra">{extra}</div> : null}
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: LucideIcon;
};

export function EmptyState({ title, description, icon: Icon = CheckCircle2 }: EmptyStateProps) {
  return (
    <div className="mobile-empty mobile-rise">
      <div className="mobile-empty__icon">
        <Icon size={24} />
      </div>
      <div className="mobile-empty__title">{title}</div>
      <div className="mobile-empty__description">{description}</div>
    </div>
  );
}

type TaskCardItem = {
  productName: string;
  plannedWeight: number;
};

export type TaskCardTask = {
  id: string;
  merchantName: string;
  status: string;
  plannedWeight: number;
  actualWeight?: number;
  routeEta: string;
  items: TaskCardItem[];
};

type TaskCardProps = {
  task: TaskCardTask;
  onClick?: () => void;
  lead?: string;
  delayMs?: number;
};

export function TaskCard({ task, onClick, lead, delayMs = 0 }: TaskCardProps) {
  const previewItems = task.items.slice(0, 3);
  const restCount = Math.max(0, task.items.length - previewItems.length);
  const weightLabel = task.actualWeight && task.actualWeight > 0
    ? `实秤 ${formatWeight(task.actualWeight)}`
    : `应配 ${formatWeight(task.plannedWeight)}`;

  return (
    <button
      type="button"
      className="task-card mobile-rise"
      onClick={onClick}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="task-card__topline">
        <span className="task-card__lead">{lead || '待处理'}</span>
        <StatusBadge status={task.status} />
      </div>

      <div className="task-card__head">
        <div>
          <div className="task-card__title">{task.merchantName}</div>
          <div className="task-card__eta">
            <Clock3 size={14} />
            <span>{task.routeEta || '路线待安排'}</span>
          </div>
        </div>
        <div className="task-card__arrow">
          <ChevronRight size={18} />
        </div>
      </div>

      <div className="task-card__chips">
        {previewItems.map(item => (
          <span key={`${task.id}_${item.productName}`} className="task-card__chip">
            {item.productName} {formatWeight(item.plannedWeight)}
          </span>
        ))}
        {restCount > 0 ? <span className="task-card__chip task-card__chip--more">+{restCount} 项</span> : null}
      </div>

      <div className="task-card__footer">
        <span>{weightLabel}</span>
        <span>{task.items.length} 个品项</span>
      </div>
    </button>
  );
}
