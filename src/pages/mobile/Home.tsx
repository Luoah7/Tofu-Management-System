import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import {
  EmptyState,
  SectionHeading,
  TaskCard,
  getStatusMeta,
} from '@/components/mobile/shared';
import { businessProfile } from '@/config/public';
import { formatWeight } from '@/utils/format';

type TaskStats = {
  total: number;
  pendingWeigh: number;
  pendingPhoto: number;
  pendingDelivery: number;
  completed: number;
  exception: number;
  totalPlannedWeight: number;
};

type Task = {
  id: string;
  merchantName: string;
  status: string;
  plannedWeight: number;
  routeEta: string;
  items: Array<{ productName: string; plannedWeight: number }>;
};

const SUMMARY_CARDS = [
  { key: 'pendingWeigh', label: '待复秤', note: '先核重量', status: '待复秤' },
  { key: 'pendingPhoto', label: '待拍照', note: '补现场图', status: '待拍照' },
  { key: 'pendingDelivery', label: '待送达', note: '等签收', status: '待送达' },
  { key: 'completed', label: '已完成', note: '今天已收口', status: '已完成' },
] as const;

export default function MobileHome() {
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    Promise.all([
      api.get<TaskStats>(`/tasks/stats?date=${today}`),
      api.get<Task[]>(`/tasks?date=${today}`),
    ])
      .then(([taskStats, taskList]) => {
        setStats(taskStats);
        setTasks(taskList);
      })
      .finally(() => setLoading(false));
  }, [today]);

  if (loading) {
    return (
      <div className="mobile-loading">
        <Spin size="large" />
      </div>
    );
  }

  const currentStats = stats ?? {
    total: 0,
    pendingWeigh: 0,
    pendingPhoto: 0,
    pendingDelivery: 0,
    completed: 0,
    exception: 0,
    totalPlannedWeight: 0,
  };

  const pendingTasks = tasks.filter(task => task.status !== '已完成' && task.status !== '异常');
  const progress = currentStats.total > 0
    ? Math.round((currentStats.completed / currentStats.total) * 100)
    : 0;
  const dateLabel = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());

  return (
    <div className="mobile-page">
      <section className="mobile-hero mobile-rise">
        <div className="mobile-hero__corner">
          <span>完成率</span>
          <strong>{progress}%</strong>
        </div>

        <div className="mobile-hero__eyebrow">{businessProfile.name} 配货端</div>
        <div className="mobile-hero__title">{dateLabel}</div>
        <div className="mobile-hero__meta">
          <span>今日 {currentStats.total} 单</span>
          <span>预计 {formatWeight(currentStats.totalPlannedWeight)}</span>
        </div>
        <div className="mobile-inline-chips">
          <span className="mobile-chip mobile-chip--light">进行中 {pendingTasks.length} 单</span>
          <span className="mobile-chip mobile-chip--dark">异常 {currentStats.exception} 单</span>
          <span className="mobile-chip mobile-chip--dark">下一站 {pendingTasks[0]?.routeEta || '待安排'}</span>
        </div>
      </section>

      <div className="mobile-stat-grid">
        {SUMMARY_CARDS.map((item, index) => {
          const meta = getStatusMeta(item.status);
          const Icon = meta.icon;
          const value = currentStats[item.key];

          return (
            <div
              key={item.key}
              className="mobile-stat-card mobile-rise"
              style={{
                animationDelay: `${80 + index * 60}ms`,
                ['--tone' as any]: {
                  blue: '#195fbc',
                  amber: '#a67510',
                  orange: '#b25a1b',
                  green: '#226a38',
                  red: '#a13838',
                  slate: '#546257',
                }[meta.tone],
                ['--tone-soft' as any]: {
                  blue: '#e7f0ff',
                  amber: '#fff2d8',
                  orange: '#ffe6cf',
                  green: '#e2f4e8',
                  red: '#fee5e2',
                  slate: '#ecf0ec',
                }[meta.tone],
              }}
            >
              <div className="mobile-stat-card__icon">
                <Icon size={20} />
              </div>
              <div className="mobile-stat-card__value">{value}</div>
              <div className="mobile-stat-card__label">{item.label}</div>
              <div className="mobile-stat-card__note">{item.note}</div>
            </div>
          );
        })}
      </div>

      {currentStats.exception > 0 ? (
        <div className="mobile-alert mobile-rise" style={{ animationDelay: '260ms' }}>
          <AlertTriangle size={18} />
          <div>
            <strong>有异常任务要盯一下</strong>
            <span>当前有 {currentStats.exception} 单需要补记录或人工处理。</span>
          </div>
        </div>
      ) : null}

      <SectionHeading
        eyebrow="今日待办"
        title="配送清单"
        extra={`${pendingTasks.length} 单未完成`}
      />

      {pendingTasks.length === 0 ? (
        <EmptyState
          title="今天已经收口"
          description="待处理任务已经清空，剩下的时间可以去看管理页或准备明天的配货。"
        />
      ) : (
        pendingTasks.map((task, index) => (
          <TaskCard
            key={task.id}
            task={task}
            lead={index === 0 ? '下一站' : '进行中'}
            delayMs={320 + index * 70}
            onClick={() => navigate(`/mobile/tasks/${task.id}`)}
          />
        ))
      )}
    </div>
  );
}
