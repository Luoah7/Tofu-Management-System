import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { AlertTriangle } from 'lucide-react';
import { api } from '@/api/client';
import {
  EmptyState,
  SectionHeading,
  getStatusMeta,
} from '@/components/mobile/shared';
import { businessProfile } from '@/config/public';
import { formatMoney, formatWeight } from '@/utils/format';

type TaskStats = {
  total: number;
  pendingWeigh: number;
  pendingDelivery: number;
  completed: number;
  exception: number;
  totalPlannedWeight: number;
  todayRevenue: number;
  monthRevenue: number;
};

const SUMMARY_CARDS = [
  { key: 'pendingWeigh', label: '待复秤', status: '待复秤' },
  { key: 'pendingDelivery', label: '待送达', status: '待送达' },
] as const;

export default function MobileHome() {
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    api.get<TaskStats>(`/tasks/stats?date=${today}`)
      .then((taskStats) => {
        setStats(taskStats);
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
    pendingDelivery: 0,
    completed: 0,
    exception: 0,
    totalPlannedWeight: 0,
    todayRevenue: 0,
    monthRevenue: 0,
  };

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
      </section>

      <div className="mobile-stat-grid mobile-stat-grid--duo">
        <div className="mobile-kpi-card mobile-rise" style={{ animationDelay: '70ms' }}>
          <span>今日收入</span>
          <strong>{formatMoney(currentStats.todayRevenue)}</strong>
        </div>
        <div className="mobile-kpi-card mobile-rise" style={{ animationDelay: '120ms' }}>
          <span>当月收入</span>
          <strong>{formatMoney(currentStats.monthRevenue)}</strong>
        </div>
      </div>

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
            </div>
          );
        })}
      </div>

      {currentStats.exception > 0 ? (
        <div className="mobile-alert mobile-rise" style={{ animationDelay: '260ms' }}>
          <AlertTriangle size={18} />
          <div>
            <strong>异常 {currentStats.exception} 单</strong>
          </div>
        </div>
      ) : null}

      <SectionHeading
        title="今日概览"
        extra={`完成率 ${progress}%`}
      />

      <div className="mobile-surface mobile-surface--padded mobile-rise" style={{ animationDelay: '320ms' }}>
        <div className="mobile-info-list">
          <div className="mobile-info-row">
            <div>
              <div className="mobile-info-row__title">今日任务</div>
              <div className="mobile-info-row__meta">已录入任务总数</div>
            </div>
            <div className="mobile-info-row__value">
              <strong>{currentStats.total} 单</strong>
            </div>
          </div>
          <div className="mobile-info-row">
            <div>
              <div className="mobile-info-row__title">已完成</div>
              <div className="mobile-info-row__meta">今日已完成配送</div>
            </div>
            <div className="mobile-info-row__value">
              <strong>{currentStats.completed} 单</strong>
            </div>
          </div>
          <div className="mobile-info-row">
            <div>
              <div className="mobile-info-row__title">待处理</div>
              <div className="mobile-info-row__meta">待配货、待复秤、待送达</div>
            </div>
            <div className="mobile-info-row__value">
              <strong>{currentStats.pendingWeigh + currentStats.pendingDelivery} 单</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
