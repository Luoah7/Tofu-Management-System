import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Spin, Alert, Space } from 'antd';
import {
  ShoppingOutlined,
  SwapOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  AccountBookOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { api } from '@/api/client';
import { formatMoney } from '@/utils/format';

type TaskStats = {
  total: number;
  pendingWeigh: number;
  pendingPhoto: number;
  pendingDelivery: number;
  completed: number;
  exception: number;
  totalPlannedWeight: number;
  totalActualWeight: number;
};

type Task = {
  id: string;
  merchantName: string;
  status: string;
  plannedWeight: number;
  actualWeight: number;
  items: Array<{ productName: string; plannedWeight: number }>;
};

type Merchant = {
  id: string; name: string; settlementDay: string; basketCount: number; status: string;
};

export default function Dashboard() {
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    Promise.all([
      api.get<TaskStats>(`/tasks/stats?date=${today}`),
      api.get<Task[]>(`/tasks?date=${today}`),
      api.get<Merchant[]>('/merchants'),
    ]).then(([s, t, m]) => {
      setStats(s);
      setTasks(t);
      setMerchants(m);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  // 有筐子的商户
  const merchantsWithBaskets = merchants.filter(m => m.basketCount > 0 && m.status === '启用');

  const statusColors: Record<string, string> = {
    '待配货': 'default', '待复秤': 'processing', '待拍照': 'warning',
    '待送达': 'orange', '已完成': 'success', '异常': 'error',
  };

  const columns = [
    { title: '商户', dataIndex: 'merchantName', key: 'merchantName' },
    {
      title: '商品', key: 'items', render: (_: any, r: Task) =>
        r.items.map(i => `${i.productName} ${i.plannedWeight}斤`).join('、'),
    },
    { title: '应配重量', dataIndex: 'plannedWeight', key: 'plannedWeight', render: (v: number) => `${v}斤` },
    { title: '实秤重量', dataIndex: 'actualWeight', key: 'actualWeight', render: (v: number) => v > 0 ? `${v}斤` : '-' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={statusColors[s] || 'default'}>{s}</Tag>,
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24, fontSize: 20, fontWeight: 600 }}>工作台</h2>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} lg={4}>
          <Card><Statistic title="今日订单" value={stats?.total || 0} prefix={<ShoppingOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card><Statistic title="预估重量" value={stats?.totalPlannedWeight || 0} suffix="斤" precision={1} /></Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card><Statistic title="待复秤" value={stats?.pendingWeigh || 0} prefix={<SwapOutlined />} valueStyle={{ color: '#1677ff' }} /></Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card><Statistic title="待拍照" value={stats?.pendingPhoto || 0} prefix={<CameraOutlined />} valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card><Statistic title="已完成" value={stats?.completed || 0} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card><Statistic title="异常" value={stats?.exception || 0} prefix={<WarningOutlined />} valueStyle={{ color: '#ff4d4f' }} /></Card>
        </Col>
      </Row>

      {/* 提醒区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {stats && stats.exception > 0 && (
          <Col span={24}>
            <Alert
              type="error"
              showIcon
              message={`${stats.exception} 个异常订单需要处理`}
              banner
            />
          </Col>
        )}
        {merchantsWithBaskets.length > 0 && (
          <Col span={24}>
            <Alert
              type="warning"
              showIcon
              icon={<InboxOutlined />}
              message={`有 ${merchantsWithBaskets.length} 家商户持有未归还筐子`}
              description={merchantsWithBaskets.map(m => `${m.name} ${m.basketCount}个`).join('、')}
              banner
            />
          </Col>
        )}
      </Row>

      {/* 今日供货清单 */}
      <Card title="今日供货清单">
        <Table dataSource={tasks} columns={columns} rowKey="id" pagination={false} size="small" />
      </Card>
    </div>
  );
}
