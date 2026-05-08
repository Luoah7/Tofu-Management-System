import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { EmptyState, SectionHeading, TaskCard } from '@/components/mobile/shared';

type Task = {
  id: string;
  merchantName: string;
  status: string;
  plannedWeight: number;
  actualWeight: number;
  routeEta: string;
  items: Array<{ productName: string; plannedWeight: number }>;
};

const STATUS_TABS = [
  { key: 'pending', label: '待处理' },
  { key: 'all', label: '全部' },
  { key: 'completed', label: '已归档' },
] as const;

export default function MobileTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<(typeof STATUS_TABS)[number]['key']>('pending');
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    api.get<Task[]>(`/tasks?date=${today}`).then(setTasks).finally(() => setLoading(false));
  }, [today]);

  const pendingCount = tasks.filter(task => task.status !== '已完成' && task.status !== '异常').length;
  const archivedCount = tasks.filter(task => task.status === '已完成' || task.status === '异常').length;

  const filtered = activeTab === 'all'
    ? tasks
    : activeTab === 'pending'
      ? tasks.filter(task => task.status !== '已完成' && task.status !== '异常')
      : tasks.filter(task => task.status === '已完成' || task.status === '异常');

  if (loading) {
    return (
      <div className="mobile-loading">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="mobile-page">
      <section className="mobile-hero mobile-rise">
        <div className="mobile-hero__corner">
          <span>总任务</span>
          <strong>{tasks.length}</strong>
        </div>

        <div className="mobile-hero__eyebrow">任务总览</div>
        <div className="mobile-hero__title">今天的配送节奏</div>
        <div className="mobile-hero__meta">
          <span>待处理 {pendingCount} 单</span>
          <span>已归档 {archivedCount} 单</span>
        </div>
        <div className="mobile-inline-chips">
          <span className="mobile-chip mobile-chip--light">直接点卡片进详情</span>
          <span className="mobile-chip mobile-chip--dark">按状态切换更顺手</span>
        </div>
      </section>

      <div className="mobile-pill-row mobile-rise" style={{ animationDelay: '90ms' }}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            className={activeTab === tab.key ? 'is-active' : ''}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <SectionHeading
        eyebrow="筛选结果"
        title={activeTab === 'pending' ? '待处理任务' : activeTab === 'completed' ? '已完成与异常' : '全部任务'}
        extra={`${filtered.length} 单`}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="这一栏现在空着"
          description="当前筛选条件下没有任务，换个状态看看就行。"
        />
      ) : (
        filtered.map((task, index) => (
          <TaskCard
            key={task.id}
            task={task}
            lead={activeTab === 'completed' ? '已归档' : '今日任务'}
            delayMs={150 + index * 60}
            onClick={() => navigate(`/mobile/tasks/${task.id}`)}
          />
        ))
      )}
    </div>
  );
}
