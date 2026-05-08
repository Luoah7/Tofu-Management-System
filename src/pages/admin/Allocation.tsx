import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Descriptions, Empty } from 'antd';
import { api } from '@/api/client';

type Task = {
  id: string;
  merchantName: string;
  merchantType: string;
  address: string;
  phone: string;
  status: string;
  plannedWeight: number;
  actualWeight: number;
  photoCount: number;
  operator: string;
  exceptionReason: string;
  items: Array<{
    id: string;
    productName: string;
    specLabel: string;
    plannedWeight: number;
    actualWeight: number;
    unitPrice: number;
  }>;
};

export default function Allocation() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    api.get<Task[]>(`/tasks?date=${today}`).then(setTasks).finally(() => setLoading(false));
  }, []);

  const getDiff = (planned: number, actual: number) => {
    if (actual === 0) return null;
    return actual - planned;
  };

  const diffColor = (diff: number | null) => {
    if (diff === null) return 'default';
    if (Math.abs(diff) > 0.5) return 'error';
    if (diff === 0) return 'success';
    return 'warning';
  };

  const columns = [
    { title: '商户', dataIndex: 'merchantName', key: 'merchantName' },
    { title: '应配重量', dataIndex: 'plannedWeight', key: 'plannedWeight', render: (v: number) => `${v}斤` },
    { title: '实秤重量', dataIndex: 'actualWeight', key: 'actualWeight', render: (v: number) => v > 0 ? `${v}斤` : <Tag>未复秤</Tag> },
    {
      title: '差异', key: 'diff',
      render: (_: any, r: Task) => {
        const diff = getDiff(r.plannedWeight, r.actualWeight);
        if (diff === null) return <Tag color="default">未复秤</Tag>;
        const sign = diff > 0 ? '+' : '';
        return <Tag color={diffColor(diff)}>{sign}{diff.toFixed(1)}斤</Tag>;
      },
    },
    { title: '照片', dataIndex: 'photoCount', key: 'photoCount', render: (v: number) => v > 0 ? `${v}张` : '-' },
    { title: '操作员', dataIndex: 'operator', key: 'operator' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => {
        const colors: Record<string, string> = {
          '待配货': 'default', '待复秤': 'processing',
          '待送达': 'orange', '已完成': 'success', '异常': 'error',
        };
        return <Tag color={colors[s] || 'default'}>{s}</Tag>;
      },
    },
    {
      title: '详情', key: 'action',
      render: (_: any, r: Task) => (
        <Button size="small" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
          {expandedId === r.id ? '收起' : '查看'}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Card title="配货记录">
        <Table
          dataSource={tasks}
          columns={columns}
          rowKey="id"
          loading={loading}
          expandable={{
            expandedRowKeys: expandedId ? [expandedId] : [],
            expandedRowRender: (record) => (
              <div style={{ padding: 16, background: '#fafafa', borderRadius: 8 }}>
                <Descriptions column={3} size="small" style={{ marginBottom: 16 }}>
                  <Descriptions.Item label="商户">{record.merchantName}</Descriptions.Item>
                  <Descriptions.Item label="类型">{record.merchantType}</Descriptions.Item>
                  <Descriptions.Item label="电话">{record.phone}</Descriptions.Item>
                  <Descriptions.Item label="地址">{record.address}</Descriptions.Item>
                  <Descriptions.Item label="操作员">{record.operator}</Descriptions.Item>
                </Descriptions>
                <Table
                  dataSource={record.items}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  columns={[
                    { title: '商品', dataIndex: 'productName' },
                    { title: '规格', dataIndex: 'specLabel' },
                    { title: '应配', dataIndex: 'plannedWeight', render: (v: number) => `${v}斤` },
                    { title: '实秤', dataIndex: 'actualWeight', render: (v: number) => v > 0 ? `${v}斤` : '-' },
                    { title: '单价', dataIndex: 'unitPrice', render: (v: number) => `¥${v}/斤` },
                  ]}
                />
                {record.exceptionReason && (
                  <div style={{ marginTop: 12, padding: 8, background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 4 }}>
                    异常原因：{record.exceptionReason}
                  </div>
                )}
              </div>
            ),
          }}
        />
      </Card>
    </div>
  );
}
